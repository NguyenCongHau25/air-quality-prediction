import { AirQualityData } from './air-quality-api';
import { fetchWeatherApi } from 'openmeteo';

// Định nghĩa các loại model được hỗ trợ
export type ModelType = 'api' | 'model';

/**
 * Interface cho kết quả dự đoán
 * Cấu trúc giống với AirQualityData để tái sử dụng biểu đồ
 */
export interface PredictionResult extends AirQualityData {
  modelUsed: string;
  confidence?: number;
}

async function fetchInputData(latitude: number, longitude: number) {
    // Fetch 30 days of history
    const params = {
        latitude: latitude,
        longitude: longitude,
        hourly: ["temperature_2m", "wind_speed_10m", "relative_humidity_2m", "surface_pressure"],
        past_days: 30,
        forecast_days: 0,
        timezone: 'Asia/Bangkok',
    };
    const url = "https://api.open-meteo.com/v1/forecast";
    const responses = await fetchWeatherApi(url, params);
    const response = responses[0];
    const utcOffsetSeconds = response.utcOffsetSeconds();
    const hourly = response.hourly()!;
    
    const time = Array.from(
        { length: (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval() },
        (_, i) => new Date((Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000)
    );
    
    const temp = hourly.variables(0)!.valuesArray()!;
    const wind = hourly.variables(1)!.valuesArray()!;
    const rh = hourly.variables(2)!.valuesArray()!;
    const p = hourly.variables(3)!.valuesArray()!;

    // Air Quality
    const aqParams = {
        latitude: latitude,
        longitude: longitude,
        hourly: ["carbon_monoxide", "nitrogen_monoxide", "nitrogen_dioxide", "ozone", "sulphur_dioxide", "ammonia"],
        past_days: 30,
        forecast_days: 0,
        timezone: 'Asia/Bangkok',
    };
    const aqUrl = "https://air-quality-api.open-meteo.com/v1/air-quality";
    const aqResponses = await fetchWeatherApi(aqUrl, aqParams);
    const aqResponse = aqResponses[0];
    const aqHourly = aqResponse.hourly()!;
    
    const co = aqHourly.variables(0)!.valuesArray()!;
    const no = aqHourly.variables(1)!.valuesArray()!;
    const no2 = aqHourly.variables(2)!.valuesArray()!;
    const o3 = aqHourly.variables(3)!.valuesArray()!;
    const so2 = aqHourly.variables(4)!.valuesArray()!;
    const nh3 = aqHourly.variables(5)!.valuesArray()!;

    // Combine
    const data = [];
    for(let i=0; i<time.length; i++) {
        // Ensure we have data for both
        if (i < co.length) {
             data.push({
                time: time[i].toISOString(),
                temp: temp[i],
                wind: wind[i],
                RH: rh[i],
                P: p[i],
                co: co[i],
                no: no[i],
                no2: no2[i],
                o3: o3[i],
                so2: so2[i],
                nh3: nh3[i],
                weather: null // Model handles missing weather
            });
        }
    }
    return data;
}

/**
 * Hàm chạy inference model
 */
export async function runModelInference(
  modelId: string,
  latitude: number,
  longitude: number,
  pollutant: 'pm2_5' | 'pm10',
  timeframe: 'hourly' | 'daily'
): Promise<PredictionResult | null> {
  console.log(`Running inference with model: ${modelId} for ${pollutant} (${timeframe})`);

  if (modelId === 'model') {
      try {
          // Call API directly without input data (it uses internal dataset)
          const res = await fetch('http://localhost:8000/predict', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({}) // Empty body
          });
          
          if (!res.ok) throw new Error('Model API failed');
          
          const prediction = await res.json();
          
          const now = new Date();
          let timeArray: string[] = [];

          if (timeframe === 'hourly') {
              timeArray = [
                  new Date(now.getTime() + 1*3600000).toISOString(),
                  new Date(now.getTime() + 2*3600000).toISOString(),
                  new Date(now.getTime() + 3*3600000).toISOString(),
              ];
          } else {
              // Daily - add days
              const d1 = new Date(now); d1.setDate(d1.getDate() + 1);
              const d2 = new Date(now); d2.setDate(d2.getDate() + 2);
              const d3 = new Date(now); d3.setDate(d3.getDate() + 3);
              timeArray = [
                  d1.toISOString(),
                  d2.toISOString(),
                  d3.toISOString(),
              ];
          }
          
          return {
              time: timeArray,
              pm2_5: prediction.pm2_5,
              pm10: prediction.pm10,
              modelUsed: 'model',
              confidence: 0.9
          };
      } catch (e) {
          console.error(e);
          return null;
      }
  }

  return null;
}
