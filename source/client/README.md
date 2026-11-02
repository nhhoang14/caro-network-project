# Client — Caro Club

React + TypeScript, Vite. Bàn cờ 15×15, bot, phòng online, ghép trận, khán giả, chat, phát lại và lịch sử. Server online sử dụng Spring Boot + MongoDB.

Chạy các lệnh tại **source/**, nơi đặt package.json dùng chung:

```powershell
npm install
npm run dev
```

Mở http://localhost:5173. Vite chuyển HTTP API và WebSocket sang Spring Boot ở cổng 3000. Cần chạy MongoDB trước.

Build và kiểm tra TypeScript: `npm run build`. Sản phẩm ở `client/dist/`, được Spring Boot phục vụ khi chạy `npm start`.

- src/App.tsx: giao diện, trạng thái, WebSocket reconnect, đấu máy.
- src/ReplayPanel.tsx: tua từng nước và phát lại tự động từ lịch sử nước đi.
- src/InvitePanel.tsx: tạo QR trong trình duyệt, chọn địa chỉ LAN/public, sao chép link mời.
- src/styles.css: bố cục responsive, bàn cờ, modal, chat.
- src/ios.css: lớp thiết kế lấy cảm hứng từ iPhone với glass effect, nút xanh, thanh tab dưới và bottom sheet trên màn hình nhỏ.
- @fontsource-variable/inter: font giao diện tự host, gồm glyph tiếng Việt; không cần tải từ CDN khi chạy.
- ../shared/game.mjs: luật và bot dùng chung.

Tên, âm thanh và lịch sử đấu máy lưu trong localStorage; token phiên chơi và mã hồ sơ khách lưu trong sessionStorage. Người chơi có thể tạo tài khoản/đăng nhập từ nút ở thanh trên cùng; phiên đăng nhập dùng cookie HttpOnly, còn lịch sử online và bảng xếp hạng lưu trong MongoDB. Thành tích khách không tự chuyển sang tài khoản mới. Mở tab độc lập hoặc trình duyệt khác để có người thứ hai. Xem README gốc để chạy LAN và tìm hiểu giao thức.
