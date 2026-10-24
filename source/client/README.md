# MODULE CLIENT

> 📘 *Sinh viên mô tả phần **client** tại đây. Điền đầy đủ theo framework và bài toán của nhóm.*

---

## 🎯 MỤC TIÊU

Client chịu trách nhiệm:
- Gửi yêu cầu đến server
- Hiển thị kết quả cho người dùng
- Cung cấp giao diện tương tác

---

## ⚙️ CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ |
|------------|-----------|
| Ngôn ngữ | Node.js / Python / Java / ... |
| Thư viện chính | Axios / Requests / ... |
| Giao thức | HTTP / WebSocket / ... |

---

## 🚀 HƯỚNG DẪN CHẠY

### Cài đặt
```bash
# Ví dụ với Node.js
npm install

# Hoặc với Python
pip install -r requirements.txt
```

### Chạy chương trình
```bash
# Ví dụ
node main.js
# hoặc
python client.py
```

### Cấu hình (nếu cần)
- Server URL: `http://localhost:8080`
- Có thể thay đổi trong file `config.js` hoặc `.env`

---

## 📦 CẤU TRÚC
```
client/
├── README.md
├── main.js (hoặc client.py)
├── config.js
└── lib/
    └── helper.js
```

---

## 💡 SỬ DỤNG
```bash
# Ví dụ gửi request
node main.js --input "data"
```

---

## 📝 GHI CHÚ

- Đảm bảo server đã chạy trước khi khởi động client
- Mặc định kết nối đến `localhost:8080`