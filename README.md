# Air quality Prediction 🌤️

Dự án website dự báo thời tiết và chất lượng không khí full-stack được xây dựng với Next.js, TypeScript, Tailwind CSS, PostgreSQL và Docker.

## 🔐 Tài khoản Test (Mặc định)

Sau khi khởi chạy cơ sở dữ liệu, bạn có thể sử dụng các tài khoản sau:

### Admin
- **Email**: `admin@weather.com`
- **Password**: `password123`
- **Quyền hạn**: Quản lý sản phẩm, xóa bài viết bất kỳ, truy cập trang quản trị.

### User
- **Email**: `user@weather.com`
- **Password**: `password123`
- **Quyền hạn**: Tạo bài viết, bình luận, xem sản phẩm.

---

## 🚀 Hướng dẫn Cài đặt & Chạy Dự án (Cho người mới bắt đầu)

Làm theo từng bước dưới đây để chạy dự án trên máy của bạn.

### Bước 1: Cài đặt các công cụ cần thiết

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:

1.  **Node.js**: Tải và cài đặt phiên bản LTS từ [nodejs.org](https://nodejs.org/).
2.  **Docker Desktop**: Tải và cài đặt từ [docker.com](https://www.docker.com/products/docker-desktop/). (Cần thiết để chạy cơ sở dữ liệu).
3.  **Git**: Tải và cài đặt từ [git-scm.com](https://git-scm.com/).

### Bước 2: Tải mã nguồn (Clone project)

Mở **Terminal** (trên Mac/Linux) hoặc **PowerShell/CMD** (trên Windows) và chạy lệnh:

```bash
git clone https://github.com/NguyenCongHau25/weather-forecast.git
cd weather-forecast
```

### Bước 3: Cài đặt thư viện (Dependencies)

Dự án này sử dụng `npm` (có sẵn khi cài Node.js) hoặc `yarn`. Bạn có thể chọn một trong hai.

**Cách 1: Sử dụng npm (Khuyên dùng nếu chưa cài yarn)**
```bash
npm install
```

**Cách 2: Sử dụng yarn (Nếu bạn muốn dùng yarn)**
Nếu chưa có yarn, cài đặt nó bằng lệnh:
```bash
npm install --global yarn
```
Sau đó cài đặt thư viện của dự án:
```bash
yarn install
```

### Bước 4: Khởi chạy Backend (Cơ sở dữ liệu)

Chúng ta sử dụng Docker để chạy cơ sở dữ liệu PostgreSQL mà không cần cài đặt phức tạp.

1.  Mở ứng dụng **Docker Desktop** và đợi nó khởi động xong.
2.  Trong terminal (tại thư mục dự án), chạy lệnh sau để tạo và chạy database:

```bash
docker run --name weather-forecast-db \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=weather_forecast_db \
  -p 5432:5432 \
  -v "$(pwd)/database/init.sql:/docker-entrypoint-initdb.d/init.sql" \
  -d postgres
```

**Lưu ý:**
- Nếu bạn gặp lỗi "container name already in use", hãy chạy lệnh sau để xóa container cũ rồi chạy lại lệnh trên:
  ```bash
  docker rm -f weather-forecast-db
  ```
- Lệnh trên sẽ tự động tạo các bảng và dữ liệu mẫu từ file `database/init.sql`.

### Bước 5: Cấu hình biến môi trường

Dự án đã có sẵn file `.env.local` với cấu hình mặc định. Nếu chưa có, hãy tạo file `.env.local` ở thư mục gốc và dán nội dung sau:

```env
# Database Configuration
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/weather_forecast_db

# JWT Secret (Mã bí mật cho đăng nhập - có thể đổi tùy ý)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2025

# Next.js API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Bước 6: Khởi chạy Frontend (Website)

Sau khi database đã chạy và thư viện đã cài xong, hãy khởi động website:

**Nếu dùng npm:**
```bash
npm run dev
```

**Nếu dùng yarn:**
```bash
yarn dev
```

Mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

---

## 🛠 Khắc phục sự cố thường gặp

### 1. Lỗi kết nối Database (Connection refused / Password authentication failed)
- Đảm bảo Docker đang chạy.
- Kiểm tra xem container có đang chạy không bằng lệnh `docker ps`.
- Kiểm tra file `.env.local` xem `DATABASE_URL` có đúng là `postgresql://myuser:mypassword@localhost:5432/weather_forecast_db` không.

### 2. Lỗi "Module not found"
- Hãy chắc chắn bạn đã chạy `npm install` hoặc `yarn install` thành công.
- Thử xóa thư mục `node_modules` và cài lại:
  ```bash
  rm -rf node_modules
  npm install
  ```

### 3. Muốn reset lại dữ liệu database?
Chạy các lệnh sau để xóa và tạo lại database mới tinh:
```bash
docker rm -f weather-forecast-db
docker run --name weather-forecast-db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=weather_forecast_db -p 5432:5432 -v "$(pwd)/database/init.sql:/docker-entrypoint-initdb.d/init.sql" -d postgres
```

## 🌟 Tính năng chính

- **Dashboard Chất lượng không khí**: Xem chỉ số PM2.5, PM10 lịch sử và dự báo tại Thủ Đức.
- **Admin Panel**: Quản lý sản phẩm, người dùng.
- **Forum**: Đăng bài, bình luận, tương tác.
- **Profile**: Quản lý thông tin cá nhân.
