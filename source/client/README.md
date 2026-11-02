# Client — Caro Club

React + TypeScript, Vite. Bàn cờ 15×15, bot, phòng online, ghép trận, khán giả, chat, phát lại và lịch sử.

Chạy các lệnh tại **source/**, nơi đặt package.json dùng chung:

```powershell
npm install
npm run dev
```

Mở http://localhost:3000. HTTP và WebSocket cùng host/cổng. Dev server dùng Vite middleware và HMR.

Build và kiểm tra TypeScript: `npm run build`. Sản phẩm ở `client/dist/`, được server phục vụ khi chạy `npm start`.

- src/App.tsx: giao diện, trạng thái, WebSocket reconnect, đấu máy.
- src/ReplayPanel.tsx: tua từng nước và phát lại tự động từ lịch sử nước đi.
- src/InvitePanel.tsx: tạo QR trong trình duyệt, chọn địa chỉ LAN/public, sao chép link mời.
- src/styles.css: bố cục responsive, bàn cờ, modal, chat.
- src/ios.css: lớp thiết kế lấy cảm hứng từ iPhone với glass effect, nút xanh, thanh tab dưới và bottom sheet trên màn hình nhỏ.
- @fontsource-variable/inter: font giao diện tự host, gồm glyph tiếng Việt; không cần tải từ CDN khi chạy.
- ../shared/game.mjs: luật và bot dùng chung.

Tên, âm thanh và lịch sử đấu máy lưu trong localStorage; token phiên và mã hồ sơ lưu trong sessionStorage để các tab độc lập có thành tích riêng. Lịch sử online/bảng xếp hạng đến từ server và tồn tại sau khi server khởi động lại. Để xem lại thành tích cá nhân sau restart, giữ tab cũ; đóng tab hoặc xóa sessionStorage có thể làm mất mã truy cập hồ sơ. Mở tab độc lập hoặc trình duyệt khác để có người thứ hai. Xem README gốc để chạy LAN và tìm hiểu giao thức.
