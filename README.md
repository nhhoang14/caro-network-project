# BÀI TẬP LỚN: LẬP TRÌNH MẠNG  

## Caro Network Project — Gomoku Online

> 📘 *Hệ thống chơi cờ Caro trực tuyến nhiều người chơi theo mô hình Client–Server, hỗ trợ giao tiếp thời gian thực qua WebSocket.*

---

## 🧑‍💻 THÔNG TIN NHÓM

| STT | Họ và Tên | MSSV | Email | Đóng góp |
|-----|-----------|------|-------|----------|
| 1 | Nguyễn Huy Hoàng | B23DCCN336 | nhhoangne@gmail.com | ... |
| 2 | Lê Doãn Trung | B23DCCN854 |  | ... |
| 3 | Nguyễn Công Quân | B23DCCN678 |  | ... |

**Tên nhóm:** Nhóm 09 – Lập trình mạng  
**Chủ đề đã đăng ký:** (Game cờ caro thi đấu đối kháng online)

---

## 🧠 MÔ TẢ HỆ THỐNG

Caro Network Project là ứng dụng web cho phép nhiều người chơi tham gia các ván cờ Caro trực tuyến thông qua mô hình Client–Server.

Hệ thống sử dụng React và TypeScript để xây dựng giao diện người dùng, Spring Boot để triển khai backend và PostgreSQL để lưu trữ dữ liệu. HTTP được sử dụng cho các thao tác thông thường, trong khi WebSocket hỗ trợ giao tiếp hai chiều theo thời gian thực giữa client và server.

Các chức năng dự kiến:

- Tạo phòng chơi và tham gia phòng bằng mã phòng.
- Chơi Caro trực tuyến giữa hai người chơi.
- Đồng bộ nước đi và trạng thái ván đấu theo thời gian thực.
- Kiểm tra lượt đi, điều kiện thắng và kết thúc ván đấu.
- Chat trong phòng chơi.
- Xem lịch sử trận đấu và bảng xếp hạng.
- Xử lý người chơi mất kết nối và các tình huống lỗi mạng cơ bản.

**Cấu trúc logic tổng quát:**
```
Browser A ─────┐
               │ HTTP / WebSocket
               ▼
         Spring Boot Server
               │
       ┌───────┴────────┐
       │                │
   Game Engine       PostgreSQL
       │
       ▼
  Room / Game State
       ▲
       │ HTTP / WebSocket
Browser B ─────┘
```

**Sơ đồ hệ thống:**

![System Diagram](./statics/diagram.png)

---

## ⚙️ CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| Server | Java + Spring Boot | REST API |
| Client | React + TypeScript | Giao tiếp HTTP |
| Database | PostgreSQL | Lưu trữ dữ liệu tạm thời |
| Triển khai | Docker | (nếu có) |

---

## 🚀 HƯỚNG DẪN CHẠY DỰ ÁN

### 1. Clone repository
```bash
git clone <repository-url>
cd caro-network-project
```

### 2. Chạy server
```bash
cd source/server

# macOS / Linux
./mvnw spring-boot:run

# Windows
mvnw.cmd spring-boot:run
```

### 3. Chạy client
```bash
cd source/client
npm install
npm run dev
```

### 4. Kiểm thử nhanh
```bash
# Các lệnh test
```

---

## 🔗 GIAO TIẾP (GIAO THỨC SỬ DỤNG)

| Endpoint | Protocol | Method | Input | Output |
|----------|----------|--------|-------|--------|
| `/health` | HTTP/1.1 | GET | — | `{"status": "ok"}` |
| `/compute` | HTTP/1.1 | POST | `{"task":"sum","payload":[1,2,3]}` | `{"result":6}` |

---

## 📊 KẾT QUẢ THỰC NGHIỆM

> Đưa ảnh chụp kết quả hoặc mô tả log chạy thử.

![Demo Result](./statics/result.png)

---

## 🧩 CẤU TRÚC DỰ ÁN
```
caro-network-project/
├── README.md
├── INSTRUCTION.md
├── statics/
│   ├── architecture.png
│   ├── sequence-diagram.png
│   ├── database-erd.png
│   └── dataset_sample.csv
│
└── source/
    ├── .gitignore
    │
    ├── client/                         # FE - React + TypeScript
    │   ├── README.md
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── index.html
    │   ├── vite.config.ts
    │   ├── tsconfig.json
    │   ├── public/
    │   └── src/
    │       ├── assets/
    │       ├── components/
    │       │   ├── Board/
    │       │   ├── Cell/
    │       │   ├── ChatBox/
    │       │   └── PlayerInfo/
    │       ├── pages/
    │       │   ├── HomePage.tsx
    │       │   ├── LoginPage.tsx
    │       │   ├── LobbyPage.tsx
    │       │   ├── GamePage.tsx
    │       │   ├── HistoryPage.tsx
    │       │   └── RankingPage.tsx
    │       ├── hooks/
    │       ├── services/
    │       │   ├── api.ts
    │       │   └── websocket.ts
    │       ├── types/
    │       ├── App.tsx
    │       └── main.tsx
    │
    └── server/                         # BE - Java + Spring Boot
        ├── README.md
        ├── pom.xml
        ├── mvnw
        ├── mvnw.cmd
        ├── .mvn/
        └── src/
            ├── main/
            │   ├── java/com/caro/
            │   │   ├── CaroApplication.java
            │   │   │
            │   │   ├── controller/
            │   │   │   ├── AuthController.java
            │   │   │   ├── UserController.java
            │   │   │   ├── RoomController.java
            │   │   │   ├── GameController.java
            │   │   │   └── RankingController.java
            │   │   │
            │   │   ├── service/
            │   │   │   ├── AuthService.java
            │   │   │   ├── UserService.java
            │   │   │   ├── RoomService.java
            │   │   │   ├── GameService.java
            │   │   │   └── RankingService.java
            │   │   │
            │   │   ├── repository/
            │   │   │   ├── UserRepository.java
            │   │   │   ├── RoomRepository.java
            │   │   │   ├── GameRepository.java
            │   │   │   └── MoveRepository.java
            │   │   │
            │   │   ├── entity/
            │   │   │   ├── User.java
            │   │   │   ├── Room.java
            │   │   │   ├── Game.java
            │   │   │   └── Move.java
            │   │   │
            │   │   ├── dto/
            │   │   │   ├── auth/
            │   │   │   ├── user/
            │   │   │   ├── room/
            │   │   │   └── game/
            │   │   │
            │   │   ├── websocket/
            │   │   │   ├── WebSocketConfig.java
            │   │   │   ├── GameWebSocketHandler.java
            │   │   │   └── WebSocketEventHandler.java
            │   │   │
            │   │   ├── gameengine/
            │   │   │   ├── Board.java
            │   │   │   ├── Move.java
            │   │   │   └── WinChecker.java
            │   │   │
            │   │   ├── config/
            │   │   └── common/
            │   │
            │   └── resources/
            │       ├── application.yml
            │       └── application-example.yml
            │
            └── test/
                └── java/com/caro/
```

---

## 🧩 HƯỚNG PHÁT TRIỂN THÊM

- [ ] Hoàn thiện giao diện và tối ưu trải nghiệm người dùng.

- [ ] Bổ sung xác thực và phân quyền người chơi.

- [ ] Hoàn thiện xử lý mất kết nối và kết nối lại.

- [ ] Bổ sung chế độ chơi với máy.

- [ ] Phát triển ghép trận ngẫu nhiên.

- [ ] Bổ sung xem lại lịch sử nước đi.

- [ ] Tối ưu hiệu suất khi có nhiều phòng chơi.

---

## 📝 GHI CHÚ

- Repo tuân thủ đúng cấu trúc đã hướng dẫn trong `INSTRUCTION.md`.
- Không commit mật khẩu database, token hoặc thông tin bí mật vào repository.

---

## 📚 TÀI LIỆU THAM KHẢO

> (Nếu có) Liệt kê các tài liệu, API docs, hoặc nguồn tham khảo đã sử dụng.
