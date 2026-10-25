# Client — Caro Club

React + TypeScript, Vite. Bàn cờ 15×15, bot, phòng online, chat và lịch sử trên trình duyệt.

Chạy các lệnh tại **source/**, nơi đặt package.json dùng chung:

```powershell
npm install
npm run dev
```

Mở http://localhost:3000. HTTP và WebSocket cùng host/cổng. Dev server dùng Vite middleware và HMR.

Build và kiểm tra TypeScript: `npm run build`. Sản phẩm ở `client/dist/`, được server phục vụ khi chạy `npm start`.

- src/App.tsx: giao diện, trạng thái, WebSocket reconnect, đấu máy.
- src/InvitePanel.tsx: tạo QR trong trình duyệt, chọn địa chỉ LAN/public, sao chép link mời.
- src/styles.css: bố cục responsive, bàn cờ, modal, chat.
- ../shared/game.mjs: luật và bot dùng chung.

Tên, âm thanh và lịch sử lưu trong localStorage; token phiên lưu sessionStorage. Mở tab độc lập hoặc trình duyệt khác để có người thứ hai. Xem README gốc để chạy LAN và tìm hiểu giao thức.
