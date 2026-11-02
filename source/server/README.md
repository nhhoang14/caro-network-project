# Server — Caro Club

Node.js 22+ và ws. Phòng, phiên, chat ở RAM; hồ sơ và lịch sử online ở file JSON. Spring Boot/PostgreSQL là định hướng phát triển tiếp.

Chạy tại **source/**:

```powershell
npm install
npm run build
npm start
```

Mặc định 0.0.0.0:3000, đổi bằng PORT. `npm run dev` thêm Vite middleware. `npm test` chạy unit tests và test với hai WebSocket client thật; test tự mở/đóng server trên cổng trống.

- index.mjs: HTTP /health, client build, WebSocket /ws, Origin, payload/rate limit, heartbeat.
- rooms.mjs: phiên, phòng, kiểm tra nước đi, chat, đồng hồ 30 giây, kết nối lại 30 giây, đầu hàng, chơi lại đổi bên.
- history.mjs: lưu hồ sơ và tối đa 5.000 kết quả online vào `server/data/history.json` bằng ghi file tạm rồi thay thế; tạo bảng xếp hạng và 30 ván gần nhất của từng hồ sơ.

Có thể đổi vị trí file bằng biến môi trường `HISTORY_FILE` (ví dụ khi chạy test hoặc mount volume). Mặc định thư mục `server/data/` được tạo tự động.
- connection.mjs: GET /api/connection chọn IPv4 LAN (ưu tiên Wi-Fi) và PUBLIC_URL nếu được cấu hình; dùng cho QR/link mời và cho phép đúng Origin public qua reverse proxy.
- ../shared/game.mjs: kiểm tra chuỗi thắng theo bốn hướng.
- test/: luật cờ, vòng đời phòng và giao thức thật.

Server là nguồn trạng thái có thẩm quyền cho online. Payload tối đa 8 KB, 30 gói/giây/kết nối; chat 300 ký tự, ít nhất 500 ms giữa hai tin/người. Giữ 60 tin/phòng, tối đa 100 phòng và 1.000 phiên. Phiên offline không có phòng bị dọn sau 10 phút.

Giao thức bổ sung `match`/`cancelMatch` cho hàng chờ ghép trận, `spectate` cho khán giả chỉ đọc và `stats` cho lịch sử/bảng xếp hạng. Khán giả không giữ ghế và không được gọi các hành động trong ván. `hello` nhận `profileToken` tùy chọn; server cấp mã hồ sơ mới nếu không có, client lưu mã này trong sessionStorage để mỗi tab độc lập có hồ sơ riêng. Không có xác thực tài khoản; đóng tab hoặc xóa sessionStorage có thể làm mất mã truy cập hồ sơ. `server/data/` bị Git bỏ qua và cần được giữ khi cập nhật server nếu muốn giữ lịch sử.

Giao thức JSON, kịch bản demo và giới hạn nằm trong README gốc.
