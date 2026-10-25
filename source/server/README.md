# Server — Caro Club

Node.js 22+ và ws, dữ liệu RAM. Spring Boot/PostgreSQL là định hướng phát triển tiếp.

Chạy tại **source/**:

```powershell
npm install
npm run build
npm start
```

Mặc định 0.0.0.0:3000, đổi bằng PORT. `npm run dev` thêm Vite middleware. `npm test` chạy unit tests và test với hai WebSocket client thật; test tự mở/đóng server trên cổng trống.

- index.mjs: HTTP /health, client build, WebSocket /ws, Origin, payload/rate limit, heartbeat.
- rooms.mjs: phiên, phòng, kiểm tra nước đi, chat, đồng hồ 30 giây, kết nối lại 30 giây, đầu hàng, chơi lại đổi bên.
- connection.mjs: GET /api/connection chọn IPv4 LAN (ưu tiên Wi-Fi) và PUBLIC_URL nếu được cấu hình; dùng cho QR/link mời và cho phép đúng Origin public qua reverse proxy.
- ../shared/game.mjs: kiểm tra chuỗi thắng theo bốn hướng.
- test/: luật cờ, vòng đời phòng và giao thức thật.

Server là nguồn trạng thái có thẩm quyền cho online. Payload tối đa 8 KB, 30 gói/giây/kết nối; chat 300 ký tự, ít nhất 500 ms giữa hai tin/người. Giữ 60 tin/phòng, tối đa 100 phòng và 1.000 phiên. Phiên offline không có phòng bị dọn sau 10 phút.

Giao thức JSON, kịch bản demo và giới hạn nằm trong README gốc.
