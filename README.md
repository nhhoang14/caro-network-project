# Caro Club — Game Caro online

Bản demo bài tập lớn **Lập trình mạng · Nhóm 09**. Chơi Caro 15×15 với máy hoặc đấu hai người qua WebSocket, có tạo phòng, chat, đếm giờ, kết nối lại, ghép trận tự động và khán giả xem trực tiếp.

Giao diện responsive lấy cảm hứng từ iOS, có thanh tab ở cạnh dưới trên điện thoại và các hộp thoại dạng bottom sheet.

| Thành viên | MSSV |
| --- | --- |
| Nguyễn Huy Hoàng | B23DCCN336 |
| Lê Doãn Trung | B23DCCN854 |
| Nguyễn Công Quân | B23DCCN678 |

## Chạy nhanh

Yêu cầu **Node.js 22+**, **Java 21**, **Maven 3.9+** và **MongoDB**. Nếu có Docker, khởi động MongoDB local bằng `docker compose up -d mongo`; nếu không, cài MongoDB hoặc đặt `MONGODB_URI` trỏ đến MongoDB của nhóm.

```powershell
cd source
npm install
npm run build
npm start
```

Mở **http://localhost:3000**. Dừng server bằng `Ctrl+C`.

Khi phát triển, chạy `npm run dev` từ `source/`: Spring Boot ở cổng 3000 và Vite ở **http://localhost:5173**. `npm test` chạy kiểm thử Java cho luật cờ, quản lý phòng, ghép trận, khán giả và kết nối lại. MongoDB phải chạy trước khi khởi động server; kiểm thử Java không cần MongoDB.

Mặc định server dùng `mongodb://localhost:27017/caro_network`. Để dùng MongoDB khác, đặt biến môi trường `MONGODB_URI` trước khi chạy. Không commit URI có mật khẩu. Nếu có lịch sử cũ trong `source/server/data/history.json`, đặt `LEGACY_HISTORY_FILE` thành đường dẫn tuyệt đối đến file đó để nhập vào MongoDB khi server khởi động.

Trên máy cá nhân, cũng có thể tạo `source/server/atlas.properties` với dòng `spring.data.mongodb.uri=<URI MongoDB>`. Spring Boot tự đọc file này và `.gitignore` bỏ qua nó; kiểm tra bằng `git check-ignore -v source/server/atlas.properties`. Không chép URI thật vào `src/main/resources/application.properties`.

Nếu cổng 3000 đang được dùng:

```powershell
$env:PORT="3001"
npm start
```

## Kịch bản demo trên một máy

1. Mở trang, bấm các ô để **đấu với máy**. Có thể đi lại nước vừa đánh.
2. Nhập tên, bấm **Tạo phòng mới** và sao chép mã phòng.
3. Mở **tab độc lập** bằng cách nhập địa chỉ vào tab mới, hoặc dùng trình duyệt khác. Nhập tên người thứ hai và mã phòng, bấm **Vào phòng**. Không dùng Duplicate tab vì trình duyệt có thể sao chép phiên của người thứ nhất.
4. Luân phiên đánh, gửi chat và quan sát bàn cờ đồng bộ. Mỗi lượt online có 30 giây.
5. Người có từ 5 quân liên tiếp thắng. Có thể đầu hàng để demo kết thúc; cả hai bấm **Chơi lại** để bắt đầu ván mới và đổi X/O.
6. Tải lại trang trong lúc chơi: token theo tab giúp khôi phục phiên. Đồng hồ tạm dừng khi một người mất kết nối, tối đa 30 giây; quá hạn xử thua người mất kết nối.
7. Bấm **Xem lại ván** để tua từng nước hoặc phát tự động. Mở **Phòng chơi** ở tab thứ ba để vào bằng nút **Xem** mà không chiếm ghế chơi.
8. Hai tab khác có thể bấm **Tìm đối thủ ngay** để được ghép tự động. Sau một trận online, mở **Lịch sử đấu** và **Bảng xếp hạng** để xem thành tích lưu trên server.

### Tài khoản người chơi

Bấm **Đăng nhập** trên thanh trên cùng, chọn **Tạo tài khoản** và nhập tên tài khoản/mật khẩu. Sau khi đăng nhập, ván online lưu theo hồ sơ tài khoản trong MongoDB; đăng nhập lại trên thiết bị khác sẽ xem được lịch sử đó. Nút tài khoản cũng có thao tác **Đăng xuất**. Người chơi vẫn có thể vào phòng với tư cách khách; lịch sử khách trước khi đăng ký không tự chuyển sang tài khoản mới. Dự án chưa có đặt lại mật khẩu.

Đấu qua LAN: máy chủ chạy server; hai máy cùng mạng mở `http://<IPv4-may-chu>:3000`. Xem IPv4 bằng `ipconfig`. QR và link mời tự chọn IPv4 LAN kể cả khi máy chủ mở trang bằng localhost. Nếu Windows hỏi tường lửa, chủ máy cần cho phép Java trên mạng riêng đang dùng.

## Chức năng đã có

- Giao diện tiếng Việt, responsive, điều khiển bàn cờ bằng phím mũi tên và Enter.
- Máy luyện tập ưu tiên thắng, chặn đối thủ rồi mở rộng đường cờ; có đi lại, đầu hàng, chơi lại.
- Phòng hai người: mã 6 ký tự, danh sách phòng chờ, tham gia bằng mã hoặc link mời.
- QR mời phòng chọn IP Wi-Fi/LAN tự động; điện thoại quét QR và nhập tên ngay đầu trang để vào chơi.
- Server xác nhận lượt, vị trí, ô trống, thắng/hòa, thời gian; client không tự quyết kết quả online.
- Chat trong phòng, tối đa 300 ký tự/tin, giữ 60 tin gần nhất.
- Hai người đồng ý để chơi lại; tự đổi bên ở ván mới.
- Kết nối lại trong 30 giây, heartbeat WebSocket, dọn phiên vắng mặt.
- Lịch sử 30 ván đấu máy trên trình duyệt, thống kê cá nhân và bật/tắt âm thanh.
- Phát lại từng nước cờ của ván hiện tại, lịch sử online hoặc ván đấu máy mới hoàn tất.
- Khán giả xem trực tiếp phòng đang chơi; không được đánh cờ, chat, đầu hàng hoặc yêu cầu chơi lại.
- Ghép trận tự động với hàng chờ và nút hủy.
- Đăng ký, đăng nhập và đăng xuất bằng tên tài khoản/mật khẩu. Tài khoản, phiên đăng nhập, lịch sử online và bảng xếp hạng lưu trong MongoDB (tối đa 5.000 trận); khách vẫn có thể chơi không cần tài khoản.

**Luật demo:** từ 5 quân liên tiếp theo ngang/dọc/chéo là thắng, kể cả bị chặn cả hai đầu. Bàn kín không có người thắng thì hòa. Đấu máy không giới hạn giờ; online hết giờ, đầu hàng hoặc rời phòng trong khi chơi sẽ thua.

## Kiến trúc

```text
React + TypeScript (Browser A) ──┐
                               ├── HTTP + WebSocket ── Spring Boot server
React + TypeScript (Browser B) ──┘                       ├── RoomService / GameRules
                                                       ├── RAM: rooms / sessions / chat
                                                       └── MongoDB: accounts / auth_sessions / profiles / matches
```

| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| Client | React 19, TypeScript, Vite 6, Inter Variable | Giao diện, WebSocket client, bot; font đóng gói local |
| Server | Java 21, Spring Boot 3.5 | HTTP, WebSocket, quản lý phòng, đồng hồ |
| Luật cờ | Java trên server; JavaScript ở client | Server kiểm tra thắng; client có bot luyện tập |
| Dữ liệu | RAM + MongoDB + browser storage | Phòng/chat trên RAM; tài khoản, phiên đăng nhập, hồ sơ và lịch sử online trong MongoDB; lịch sử đấu máy trên trình duyệt |
| Kiểm thử | JUnit 5 | Luật cờ, quản lý phòng và giao thức sự kiện |

Theo quyết định hiện tại của nhóm, backend dùng Spring Boot và dữ liệu bền vững dùng MongoDB. Mã Node.js cũ còn ở `source/server/*.mjs` làm tài liệu tham chiếu; lệnh chạy chính đã chuyển sang Java.

## HTTP và giao thức WebSocket

| Endpoint | Giao thức | Mô tả |
| --- | --- | --- |
| GET / | HTTP | Phục vụ giao diện React đã build |
| GET /health | HTTP/JSON | Trả status, số phòng và transport WebSocket |
| GET /api/connection | HTTP/JSON | Các địa chỉ LAN và URL public đã cấu hình để tạo QR |
| GET /api/auth/me | HTTP/JSON | Trả tài khoản đang đăng nhập hoặc `null` |
| POST /api/auth/register | HTTP/JSON | Tạo tài khoản và đăng nhập |
| POST /api/auth/login | HTTP/JSON | Đăng nhập |
| POST /api/auth/logout | HTTP | Đăng xuất, thu hồi phiên |
| /ws | WebSocket | Kết nối hai chiều, gói tin JSON |

Client mở `/ws`, gửi `hello` trước hành động khác. Token phiên chơi do server sinh ngẫu nhiên, lưu `sessionStorage` để mỗi tab độc lập. Khi đã đăng nhập, cookie `caro_auth` dạng HttpOnly xác định hồ sơ tài khoản; server bỏ qua mã hồ sơ khách trong gói `hello`.

| Client → server | Dữ liệu mẫu |
| --- | --- |
| Kết nối / tiếp tục phiên | `{ "type": "hello", "token": null }` |
| Tạo phòng | `{ "type": "create", "name": "An" }` |
| Tham gia | `{ "type": "join", "name": "Bình", "roomId": "A1B2C3" }` |
| Ghép trận / hủy | `{ "type": "match", "name": "An" }` / `{ "type": "cancelMatch" }` |
| Xem phòng | `{ "type": "spectate", "roomId": "A1B2C3" }` |
| Đánh cờ | `{ "type": "move", "index": 112 }` |
| Chat | `{ "type": "chat", "text": "Xin chào!" }` |
| Đầu hàng | `{ "type": "resign" }` |
| Đồng ý ván mới | `{ "type": "rematch" }` |
| Rời phòng | `{ "type": "leave" }` |
| Làm mới thống kê | `{ "type": "stats" }` |

Chỉ số ô 0–224, bằng `row * 15 + column` (hàng/cột từ 0). Khách có thể gửi `profileToken` trong `hello`; người đăng nhập dùng cookie. Server gửi `welcome` (id, token phiên, profileId, profileToken nếu là khách, giờ server), `lobby` (các phòng gồm trạng thái/số khán giả, số phiên online, số người chờ ghép), `matchmaking`, `stats` (30 trận online gần nhất của hồ sơ và 20 vị trí bảng xếp hạng), `room` (snapshot bàn cờ, người chơi, khán giả, lượt, deadline, chat, kết quả), `left`, `error`. Mỗi nước hợp lệ tạo một snapshot gửi người chơi và khán giả. Chat cũng gửi snapshot đầy đủ để giữ giao thức đơn giản cho demo.

## Cấu trúc

```text
caro-network-project/
├── README.md
├── INSTRUCTION.md              # Giữ nguyên tài liệu giảng viên
├── statics/
│   ├── diagram.png
│   └── logo.png
└── source/
    ├── package.json
    ├── package-lock.json
    ├── client/
    │   ├── README.md
    │   ├── index.html
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   └── src/
    │       ├── main.tsx
    │       ├── App.tsx
    │       ├── InvitePanel.tsx   # QR và link mời LAN/Internet
    │       ├── ReplayPanel.tsx   # Phát lại từng nước
    │       ├── styles.css
    │       └── ios.css          # Lớp giao diện iOS, tab bar và bottom sheet
    ├── server/
    │   ├── pom.xml              # Maven và Spring Boot
    │   ├── src/main/java/com/caroclub/
    │   │   ├── CaroSocketHandler.java
    │   │   ├── RoomService.java
    │   │   ├── MongoHistoryStore.java
    │   │   └── ...
    │   ├── src/test/java/com/caroclub/
    │   ├── *.mjs                # Backend Node.js cũ, chỉ làm tham chiếu
    │   └── data/                # File JSON cũ; có thể nhập vào MongoDB
    └── shared/
        ├── game.mjs            # Luật cờ, bot
        └── game.d.mts          # Kiểu cho TypeScript
```

## Giới hạn demo

- Phòng, phiên và chat lưu RAM, mất khi khởi động lại server. Tối đa 100 phòng và 1.000 phiên; lịch sử online và hồ sơ lưu MongoDB, tối đa 5.000 trận gần nhất.
- Tài khoản dùng tên người dùng 3–24 ký tự và mật khẩu ít nhất 8 ký tự; mật khẩu được băm BCrypt. Phiên đăng nhập lưu MongoDB và cấp cookie HttpOnly, SameSite=Lax, hết hạn sau 30 ngày. Người chơi khách vẫn nhận diện bằng mã của từng tab; xóa `sessionStorage` có thể làm mất quyền xem lịch sử khách. Thành tích khách trước khi đăng ký không tự chuyển vào tài khoản.
- Lịch sử đấu máy lưu trên trình duyệt, có thể mất khi xóa dữ liệu. Luyện tập không được server xác nhận. Các mục lịch sử cũ trước bản nâng cấp không có chuỗi nước đi để phát lại.
- Một phiên chỉ có một kết nối. Tab nhân bản có thể dùng chung token; mở tab độc lập/trình duyệt khác để demo hai người.
- Server giới hạn payload 8 KB, tốc độ gói tin/chat và kiểm tra Origin cùng host cho trình duyệt. Đăng nhập qua Internet cần HTTPS/WSS; HTTP trên LAN không mã hóa mật khẩu khi truyền. Endpoint tài khoản yêu cầu JSON, header `X-Caro-Request: 1` và Origin hợp lệ.
- Font Inter Variable được đóng gói cùng bản build và có font hệ thống dự phòng. Backend cần kết nối MongoDB khi khởi động.

## Quét QR bằng điện thoại

1. Máy tính và điện thoại dùng **cùng Wi-Fi**. Chạy server rồi mở game trên máy tính.
2. Nhập tên và **Tạo phòng mới**. Thẻ mời hiển thị QR và link có IPv4 LAN, không dùng localhost.
3. Điện thoại mở Camera/Zalo quét QR. Trang mở với lời mời ở đầu trang: nhập tên rồi bấm **Vào phòng**.
4. Chơi như bình thường; HTTP và WebSocket đều đi qua cùng cổng. Nếu có nhiều card mạng, chọn đúng địa chỉ trong danh sách cạnh QR.

Nếu điện thoại không mở được link, kiểm tra cùng Wi-Fi, mạng khách có cô lập thiết bị hay không, và quyền Java trong Windows Firewall. Máy chủ phải tiếp tục chạy. Khi IP Wi-Fi thay đổi, tải lại trang/tạo lại QR. Trên HTTP LAN, trình duyệt có thể không cho sao chép tự động; có thể nhấn giữ link để sao chép.

### Chơi qua 4G/5G hoặc Wi-Fi khác

QR chứa một đường link, không tự mở cổng Internet. Để chơi khác mạng, server cần một URL public qua hosting hoặc tunnel. Demo hỗ trợ biến môi trường **PUBLIC_URL** để cả QR và kiểm tra Origin của WebSocket dùng đúng tên miền public.

Ví dụ với [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) sau khi cài cloudflared theo tài liệu chính thức:

```powershell
# Cửa sổ riêng: tạo link tạm cho server chạy trên cổng 3001
cloudflared tunnel --url http://localhost:3001
```

Sau khi công cụ in ra địa chỉ https://...trycloudflare.com, khởi động lại game từ source/ với **địa chỉ thực tế vừa được cấp**:

```powershell
$env:PORT="3001"
$env:PUBLIC_URL="https://TEN-THUC-TE.trycloudflare.com"
npm start
```

Giữ cả server và tunnel chạy, tạo phòng mới và quét QR Internet. Khởi động lại server sẽ xóa các phòng cũ. URL ví dụ ở trên không phải URL đã triển khai. Quick Tunnel dùng cho thử nghiệm, địa chỉ thay đổi mỗi lần chạy; người có link có thể truy cập demo. Chưa tự tạo hay công bố tunnel trong repo này.

API **GET /api/connection** trả danh sách địa chỉ LAN và PUBLIC_URL đã cấu hình. Không tin các header proxy tùy ý để cấp quyền WebSocket; chỉ chấp nhận cùng host hoặc đúng PUBLIC_URL được chủ server đặt.
