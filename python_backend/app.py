import pandas as pd
import numpy as np
import pickle
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sklearn.base import BaseEstimator, TransformerMixin
from statsmodels.tsa.seasonal import STL
from scipy.interpolate import interp1d
from statsmodels.nonparametric.smoothers_lowess import lowess
from sklearn.preprocessing import MinMaxScaler
import uvicorn
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Weather Forecast Model API is running"}

# --- Custom Classes (Must match the ones used in pickle) ---

cols_in_ordered = ['time', 'temp', 'weather', 'wind', 'RH', 'P', 'co', 'no', 'no2', 'o3', 'so2', 'nh3', 'pm2_5_next1', 
                   'pm10_next1', 'pm2_5_next2', 'pm10_next2', 'pm2_5_next3', 'pm10_next3']

class FeaturesInOrder(BaseEstimator, TransformerMixin):
    def __init__(self, cols_in_ordered):
        self.cols_in_ordered = cols_in_ordered

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()
        # Ensure all columns exist, fill with NaN if missing
        for col in self.cols_in_ordered:
            if col not in X.columns:
                X[col] = np.nan
        X = X[self.cols_in_ordered]
        return X

class MissingValueFiller(BaseEstimator, TransformerMixin):
    def __init__(self, cols_in_ordered = cols_in_ordered, num_cols=None, cat_cols=None, time_col="time", cat_window=4):
        self.cols_in_ordered = cols_in_ordered
        self.num_cols = num_cols
        self.cat_cols = cat_cols
        self.time_col = time_col
        self.cat_window = cat_window
        self.most_common_per_hour_ = {} 

    def fit(self, X, y=None):
        X = X.copy()
        if self.cat_cols:
            X['hour'] = X[self.time_col].dt.hour
            
            for col in self.cat_cols:
                self.most_common_per_hour_[col] = X.groupby('hour')[col].agg(
                    lambda x: x.mode().tolist() if not x.mode().empty else [np.nan]
                ).to_dict()

        return self

    def transform(self, X):
        X = X.copy()
        
        # --- Numerical ---
        if self.num_cols:
            for col in self.num_cols:
                if col in X.columns:
                    X[col] = X[col].mask(X[col] < 0, np.nan)
                    X[col] = X[col].interpolate(method='cubic', limit_direction='both')
                    X[col] = X[col].ffill().bfill()
        
        # --- Categorical ---
        if self.cat_cols:
            X[self.time_col] = pd.to_datetime(X[self.time_col], errors='coerce')
            X['hour'] = X[self.time_col].dt.hour
            for col in self.cat_cols:
                if col in X.columns:
                    vals = X[col].tolist()
                    col_filled = []
                    for i in range(len(vals)):
                        start = max(0, i - self.cat_window//2)
                        end = min(len(vals), i + self.cat_window//2 + 1)
                        window_vals = [v for v in vals[start:end] if pd.notna(v)]
                        if window_vals:
                            col_filled.append(pd.Series(window_vals).mode()[0])
                        else:
                            col_filled.append(np.nan)
                    X[col] = col_filled

                    # Điền NaN còn lại theo mode cùng giờ
                    # Note: self.most_common_per_hour_ might be empty if fit wasn't called or loaded correctly
                    # Assuming it's loaded from pickle
                    if hasattr(self, 'most_common_per_hour_') and col in self.most_common_per_hour_:
                         X[col] = X.apply(
                            lambda row: self.most_common_per_hour_[col].get(row['hour'], [np.nan])[0]
                            if pd.isna(row[col]) else row[col], axis=1
                        )
            X = X.drop(columns=['hour'])
        
        return X

class TSOutlierRemover(BaseEstimator, TransformerMixin):
    def __init__(self, num_cols=None, seasonal_period=1000, seasonal_strength_threshold=0.6, k=3):
        self.num_cols = num_cols
        self.seasonal_period = seasonal_period
        self.seasonal_strength_threshold = seasonal_strength_threshold
        self.k = k
        self.q1_ = {}
        self.q3_ = {}

    def fit(self, X, y=None):
        # Fit logic omitted as we expect to load a fitted pipeline
        return self

    def transform(self, X, y=None):
        X_clean = X.copy()
        
        # If num_cols is None, try to infer or skip
        cols_to_process = self.num_cols if self.num_cols else []

        for col in cols_to_process:
            if col not in X_clean.columns:
                continue
                
            x = X_clean[col].values
            n = len(x)

            # STL decomposition
            if n >= 2 * self.seasonal_period:
                stl = STL(x, period=self.seasonal_period, robust=True)
                res = stl.fit()
                seasonal = res.seasonal
                trend = res.trend
                var_no_season = np.var(x - trend)
                var_with_season = np.var(x - trend - seasonal)
                F_s = 1 - var_with_season / var_no_season
                x_adj = x - seasonal if F_s > self.seasonal_strength_threshold else x
            else:
                x_adj = x

            # Trend estimation
            frac = min(0.3, 20 / n) if n > 0 else 0.3
            trend_est = lowess(x_adj, np.arange(n), frac=frac, return_sorted=False)

            # Remainder
            remainder_est = x_adj - trend_est

            # Use stored Q1, Q3 from fit
            if col in self.q1_ and col in self.q3_:
                Q1 = self.q1_[col]
                Q3 = self.q3_[col]
                IQR = Q3 - Q1
                lower_bound = Q1 - self.k * IQR
                upper_bound = Q3 + self.k * IQR

                outliers = (remainder_est < lower_bound) | (remainder_est > upper_bound)

                # Replace outliers by linear interpolation
                x_clean_col = x.copy()
                if np.any(outliers):
                    idx = np.arange(n)
                    # Only interpolate if we have enough non-outliers
                    if len(idx[~outliers]) > 1:
                        f = interp1d(idx[~outliers], x_clean_col[~outliers], kind='linear', fill_value="extrapolate")
                        x_clean_col[outliers] = f(idx[outliers])
                
                X_clean[col] = x_clean_col

        return X_clean

class ClearNegativeValue(BaseEstimator, TransformerMixin):
    def __init__(self, positive_col):
        self.positive_col = positive_col
    
    def fit(self, X, y=None):
        return self
    
    def transform(self, X, y=None):
        X = X.copy()  
        for col in self.positive_col:
            if col in X.columns:
                X.loc[X[col] < 0, col] = 0
        return X

class FixSkewedColumn(BaseEstimator, TransformerMixin):
    def __init__(self, skewed_col):
        self.skewed_col = skewed_col
    
    def fit(self, X, y=None):
        return self
    
    def transform(self, X, y=None):
        X = X.copy()
        # Handle both single string and list of strings
        cols_to_fix = self.skewed_col if isinstance(self.skewed_col, list) else [self.skewed_col]
        
        for col in cols_to_fix:
            if col in X.columns:
                X[col] = X[col].apply(lambda x: np.log1p(x) if x > -1 else x)
        return X

class RankEncodeFeature(BaseEstimator, TransformerMixin):
    def __init__(self, cat_col, target_col, time_col=None):
        self.cat_col = cat_col
        self.target_col = target_col
        self.time_col = time_col
        self.rank_maps = {}

    def fit(self, X, y=None):
        return self

    def transform(self, X, y=None):
        X = X.copy()

        for target in self.target_col:
            for cat in self.cat_col:
                if cat not in X.columns: continue
                
                new_col = f"{cat}_{target}"
                mapped = X[cat].map(self.rank_maps.get(new_col, {}))
                rank_values = list(self.rank_maps.get(new_col, {}).values())
                if len(rank_values) > 0:
                    mode_val = pd.Series(rank_values).mode()[0]
                else:
                    mode_val = 0

                X[new_col] = mapped.fillna(mode_val)

        X = X.drop(columns=self.cat_col, errors="ignore")
        return X

class ExtractTime(BaseEstimator, TransformerMixin):
    def __init__(self, time_col):
        self.time_col = time_col
    
    def fit(self, X, y=None):
        return self  
    
    def transform(self, X, y=None):
        df = X.copy()
        if self.time_col in df.columns:
            time_series = pd.to_datetime(df[self.time_col], errors='coerce')
            df['year'] = time_series.dt.year
            df['month'] = time_series.dt.month
            df['day'] = time_series.dt.day
            df['dayofweek'] = time_series.dt.dayofweek
            df['hour'] = time_series.dt.hour
            df = df.drop(columns=[self.time_col])
        return df

class MinMaxScalerDF(BaseEstimator, TransformerMixin):
    def __init__(self, cols):
        self.cols = cols
        self.scaler = MinMaxScaler()

    def fit(self, X, y=None):
        return self

    def transform(self, X, y=None):
        X = X.copy()
        # Only transform columns that exist
        valid_cols = [c for c in self.cols if c in X.columns]
        if valid_cols:
            X[valid_cols] = self.scaler.transform(X[valid_cols])
        return X

# --- Helper Functions ---

def add_lag_feature(data, lag_list, cols_added, time_col="time"):
    df = data.copy()
    cols_valid = [c for c in cols_added if c in df.columns]
    lag_dict = {}

    for col in cols_valid:
        for lag in lag_list:
            new_col = f"{col}_lag_{lag}"
            lag_dict[new_col] = df[col].shift(lag)

    df = pd.concat([df, pd.DataFrame(lag_dict)], axis=1)
    return df

def add_rolling_mean(data, rolling_list, cols_added, time_col="time"):
    df = data.copy()
    cols_valid = [c for c in cols_added if c in df.columns]
    roll_dict = {}

    for col in cols_valid:
        for roll in rolling_list:
            new_col = f"{col}_rollmean_{roll}"
            roll_dict[new_col] = df[col].rolling(window=roll).mean()

    df = pd.concat([df, pd.DataFrame(roll_dict)], axis=1)
    return df

# --- Load Models ---

MODEL_DIR = "models"
pre_pipeline = None
fe_pipeline = None
model_pm2_5 = None
model_pm10 = None

# Hack to make pickle work if the model was saved in __main__
import __main__
setattr(__main__, "FeaturesInOrder", FeaturesInOrder)
setattr(__main__, "MissingValueFiller", MissingValueFiller)
setattr(__main__, "TSOutlierRemover", TSOutlierRemover)
setattr(__main__, "ClearNegativeValue", ClearNegativeValue)
setattr(__main__, "FixSkewedColumn", FixSkewedColumn)
setattr(__main__, "RankEncodeFeature", RankEncodeFeature)
setattr(__main__, "ExtractTime", ExtractTime)
setattr(__main__, "MinMaxScalerDF", MinMaxScalerDF)

def load_models():
    global pre_pipeline, fe_pipeline, model_pm2_5, model_pm10
    try:
        pre_pipeline = joblib.load(os.path.join(MODEL_DIR, "full_preprocess_pipeline.pkl"))
        fe_pipeline = joblib.load(os.path.join(MODEL_DIR, "full_featureengineer_pipeline.pkl"))
        with open(os.path.join(MODEL_DIR, "best_pm2.5_xgb.pkl"), "rb") as f:
            model_pm2_5 = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "best_pm10_rf.pkl"), "rb") as f:
            model_pm10 = pickle.load(f)
        print("Models loaded successfully")
    except Exception as e:
        print(f"Error loading models: {e}")
        import traceback
        traceback.print_exc()

load_models()

# --- API ---

class WeatherData(BaseModel):
    time: str
    temp: float
    wind: float
    RH: float
    P: float
    co: float
    no: float
    no2: float
    o3: float
    so2: float
    nh3: float
    weather: Optional[str] = None

@app.post("/predict")
async def predict():
    if not pre_pipeline or not fe_pipeline or not model_pm2_5 or not model_pm10:
        raise HTTPException(status_code=500, detail="Models not loaded")

    try:
        # Load dataset
        data = pd.read_csv("Dataset_ThuDuc_9202182025.csv")
        
        # Prepare data (last 5000 rows)
        num_col = ["temp", "wind", "RH", "P", "co", "no", "no2", "o3", "so2", "nh3"]
        data_demo = data[-5000:].copy()
        data_demo[num_col] = data_demo[num_col].clip(lower=0)
        
        target_cols = ['pm2_5_next1', 'pm10_next1', 'pm2_5_next2', 'pm10_next2', 'pm2_5_next3', 'pm10_next3']
        data_demo[target_cols] = np.nan
        
        # Preprocessing
        df_processed = pre_pipeline.transform(data_demo)
        df_processed = fe_pipeline.transform(df_processed)
        
        # Feature Engineering (Lags & Rolling)
        lag_list = [1,3,6,12,24,36,48]
        rolling_list = [r*720 for r in [1,3,6]] + [168,336,504]
        
        # Note: 'weather0', 'weather1' might be generated by RankEncodeFeature or similar if 'weather' was categorical
        # We need to check what columns are available after pipeline
        # For now, use num_col and check for weather columns
        cols_for_lag = num_col + [c for c in ['weather0', 'weather1'] if c in df_processed.columns]
        
        df_processed = add_lag_feature(df_processed, lag_list, cols_for_lag)
        df_processed = add_rolling_mean(df_processed, rolling_list, num_col)
        
        # Prepare for prediction (take the last row)
        # We need to drop target columns if they exist (they are NaN anyway)
        all_target_col  = ["pm2_5_next1", "pm10_next1", "pm2_5_next2", "pm10_next2", "pm2_5_next3", "pm10_next3"]
        X_test = df_processed.drop(columns=all_target_col, errors='ignore')
        X_test = X_test.iloc[[-1]] # Take last row as DataFrame
        
        # Predict
        pred_pm2_5 = model_pm2_5.predict(X_test)
        pred_pm10 = model_pm10.predict(X_test)
        
        # Handle output format (might be numpy array or dataframe depending on model)
        # XGBoost predict returns numpy array
        # RandomForest predict returns numpy array
        
        # If multi-output, it returns shape (n_samples, n_outputs)
        pm2_5_val = pred_pm2_5[0] if len(pred_pm2_5.shape) > 1 else pred_pm2_5
        pm10_val = pred_pm10[0] if len(pred_pm10.shape) > 1 else pred_pm10

        return {
            "pm2_5": pm2_5_val.tolist() if isinstance(pm2_5_val, np.ndarray) else list(pm2_5_val),
            "pm10": pm10_val.tolist() if isinstance(pm10_val, np.ndarray) else list(pm10_val)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
