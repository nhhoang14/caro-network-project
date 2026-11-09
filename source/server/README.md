# Server — Caro Club

Backend chính sử dụng Java 21, Spring Boot 3.5 và Spring Data MongoDB. Giao thức HTTP/WebSocket vẫn tương thích với client React hiện tại.

## Chạy

Khởi động MongoDB local ở `mongodb://localhost:27017`, hoặc đặt `MONGODB_URI` trỏ đến MongoDB của nhóm. Từ thư mục `source/`:

```powershell
npm install
npm start
```

`npm start` tự build React, chạy Maven/Spring Boot trên cổng 3000 và phục vụ bản frontend vừa build. Để phát triển giao diện, dùng `npm run dev`: script đợi `/health` của Spring Boot sẵn sàng rồi mới mở Vite ở cổng 5173, sau đó Vite chuyển `/ws`, `/api` và `/health` sang Spring Boot ở cổng 3000. Có thể chạy riêng `npm run dev:server` và `npm run dev:client`.

Biến môi trường:

| Tên | Mặc định | Công dụng |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://localhost:27017/caro_network` | Kết nối MongoDB; có thể dùng Atlas hoặc server của nhóm |
| `PORT` | `3000` | Cổng HTTP/WebSocket |
| `PUBLIC_URL` | rỗng | Origin public cho QR/link mời và WebSocket |
| `LEGACY_HISTORY_FILE` | rỗng | File JSON cũ để nhập một lần vào MongoDB |

Nếu đã có `source/server/data/history.json`, nhập hồ sơ và ván cũ bằng cách đặt `LEGACY_HISTORY_FILE` thành đường dẫn tuyệt đối của file trước khi chạy. Quá trình nhập kiểm tra ID nên chạy lại không tạo bản ghi trùng. Không đưa mật khẩu MongoDB hoặc file `.env` lên Git.

Để dùng URI MongoDB riêng trên máy mà không đưa mật khẩu lên GitHub, tạo `source/server/atlas.properties` với một dòng `spring.data.mongodb.uri=<URI của bạn>`. File này được `.gitignore` bỏ qua và Spring Boot tự nạp khi chạy từ `source/` hoặc `source/server/`. Kiểm tra bằng `git check-ignore -v source/server/atlas.properties`; không đưa URI thật vào `src/main/resources/application.properties`.

## Cấu trúc

Cấu trúc package của server (`com.caroclub`):
- `CaroApplication`: Điểm khởi chạy ứng dụng Spring Boot.
- `controller/`:
  - `AuthController`: REST API xác thực (`/api/auth/me`, `/register`, `/login`, `/logout`).
  - `HttpApi`: REST API kiểm tra trạng thái (`/health`) và địa chỉ kết nối LAN/Internet (`/api/connection`).
- `service/`:
  - `AuthService`: Nghiệp vụ đăng ký, đăng nhập băm BCrypt, quản lý phiên.
  - `RoomService`: Điều phối phòng chơi, ghép cặp, lượt đi, chat, đồng hồ, khán giả và chơi lại.
  - `GameRules`: Kiểm tra điều kiện thắng cờ Caro (5 quân liên tiếp).
  - `MatchmakingQueue`: Hàng chờ ghép trận tự động.
  - `RoomViewFactory`: Ánh xạ trạng thái phòng trong RAM sang payload WebSocket.
- `model/`:
  - `Account`: Thực thể tài khoản người dùng (`accounts`).
  - `AuthSession`: Phiên đăng nhập người dùng (`auth_sessions`).
  - `Profile`: Hồ sơ người chơi (`profiles`).
  - `MatchRecord`: Bản ghi ván đấu (`matches`).
- `repository/`:
  - `HistoryStore`: Interface trừu tượng hoá kho lưu trữ lịch sử và bảng xếp hạng.
  - `MongoHistoryStore`: Lưu trữ và truy vấn MongoDB (với In-memory fallback).
- `config/`:
  - `SocketConfig`: Cấu hình WebSocket endpoint (`/ws`) và bắt tay kết nối.
- `websocket/`:
  - `CaroSocketHandler`: Bộ xử lý WebSocket, xác thực handshake, heartbeat, rate limiting.
- `tcp/`:
  - `TcpServer`: Socket Server thuần TCP chạy song song ở cổng 3001.
- `util/`:
  - `ConnectionPolicy`: Kiểm tra Origin an toàn, lọc IP mạng LAN và chuẩn hóa URL.

Phòng, phiên chơi, hàng chờ và chat hiện hành giữ trong RAM; MongoDB lưu `accounts`, `auth_sessions`, `profiles`, `matches` gồm chuỗi nước đi. Mật khẩu băm BCrypt; cookie đăng nhập HttpOnly/SameSite=Lax có hạn 30 ngày, token phiên chỉ lưu dạng băm SHA-256 trong MongoDB. Khách vẫn dùng mã hồ sơ trong `sessionStorage`. Tài khoản mới có hồ sơ riêng nên lịch sử khách không tự nhập vào tài khoản. Mỗi ván có ID riêng nên kết quả không bị ghi hai lần.

API tài khoản: `GET /api/auth/me`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`. Các lệnh POST cần `X-Caro-Request: 1`, Origin cùng trang và JSON cho đăng ký/đăng nhập. Khi đăng nhập, WebSocket dùng hồ sơ tài khoản theo cookie; đăng xuất thu hồi phiên và đóng WebSocket tương ứng. Triển khai công khai phải dùng HTTPS/WSS; HTTP trên LAN không mã hóa mật khẩu khi truyền.

Lệnh kiểm thử toàn dự án: `npm test` trong `source/`. Chỉ kiểm thử Java: `mvn -f source/server/pom.xml test` khi chạy ở thư mục gốc. Kiểm thử không cần MongoDB; để chạy ứng dụng thật cần MongoDB sẵn sàng. Spring Boot là backend duy nhất của dự án.
