# Server — Caro Club

Backend chính sử dụng Java 21, Spring Boot 3.5 và Spring Data MongoDB. Giao thức HTTP/WebSocket vẫn tương thích với client React hiện tại.

## Chạy

Khởi động MongoDB local ở `mongodb://localhost:27017`, hoặc đặt `MONGODB_URI` trỏ đến MongoDB của nhóm. Từ thư mục `source/`:

```powershell
npm install
npm run build
npm start
```

`npm start` chạy Maven/Spring Boot trên cổng 3000 và phục vụ bản React đã build. Để phát triển giao diện, dùng `npm run dev`: Vite ở cổng 5173 chuyển `/ws`, `/api` và `/health` sang Spring Boot ở cổng 3000. Có thể chạy riêng `npm run dev:server` và `npm run dev:client`.

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

- `CaroSocketHandler`: `/ws`, xác nhận `hello`, giới hạn tốc độ, heartbeat.
- `RoomService`: phòng, phiên, lượt chơi, chat, đồng hồ, khán giả, ghép trận, chơi lại.
- `GameRules`: kiểm tra 5 quân liên tiếp. Bot luyện tập vẫn ở client.
- `MongoHistoryStore`: collection `profiles` và `matches`, lịch sử 30 ván và bảng xếp hạng 20 người.
- `HttpApi`: `/health` và `/api/connection`.
- `AuthController`/`AuthService`: đăng ký, đăng nhập, đăng xuất; cookie phiên; tài khoản và phiên trong MongoDB.

Phòng, phiên chơi, hàng chờ và chat hiện hành giữ trong RAM; MongoDB lưu `accounts`, `auth_sessions`, `profiles`, `matches` gồm chuỗi nước đi. Mật khẩu băm BCrypt; cookie đăng nhập HttpOnly/SameSite=Lax có hạn 30 ngày, token phiên chỉ lưu dạng băm SHA-256 trong MongoDB. Khách vẫn dùng mã hồ sơ trong `sessionStorage`. Tài khoản mới có hồ sơ riêng nên lịch sử khách không tự nhập vào tài khoản. Mỗi ván có ID riêng nên kết quả không bị ghi hai lần.

API tài khoản: `GET /api/auth/me`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`. Các lệnh POST cần `X-Caro-Request: 1`, Origin cùng trang và JSON cho đăng ký/đăng nhập. Khi đăng nhập, WebSocket dùng hồ sơ tài khoản theo cookie; đăng xuất thu hồi phiên và đóng WebSocket tương ứng. Triển khai công khai phải dùng HTTPS/WSS; HTTP trên LAN không mã hóa mật khẩu khi truyền.

Lệnh kiểm thử: `mvn -f source/server/pom.xml test` khi chạy ở thư mục gốc. Kiểm thử này không cần MongoDB; để chạy ứng dụng thật cần MongoDB sẵn sàng. Backend Node.js trước đây còn trong thư mục này làm tài liệu tham chiếu, nhưng các lệnh npm hiện chạy Spring Boot.
