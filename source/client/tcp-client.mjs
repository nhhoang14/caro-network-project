import net from "node:net";
import readline from "node:readline";

const TCP_PORT = Number(process.env.TCP_PORT || 3001);
const TCP_HOST = process.env.TCP_HOST || "127.0.0.1";

console.log("=================================================");
console.log("   CARO CLUB — TCP SOCKET CLIENT (PORT " + TCP_PORT + ")");
console.log("   Chương trình Console dòng lệnh học phần Lập trình mạng");
console.log("=================================================");

const socket = net.createConnection({ port: TCP_PORT, host: TCP_HOST }, () => {
  console.log(`[TCP] Đã kết nối thành công tới Server TCP tại ${TCP_HOST}:${TCP_PORT}`);
  send({ type: "hello" });
});

let buffer = Buffer.alloc(0);
let currentRoom = null;
let myUserId = null;
let myName = "Người chơi";

function send(payload) {
  const jsonStr = JSON.stringify(payload);
  const data = Buffer.from(jsonStr, "utf-8");
  const header = Buffer.alloc(4);
  header.writeInt32BE(data.length, 0);
  socket.write(Buffer.concat([header, data]));
}

socket.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const len = buffer.readInt32BE(0);
    if (buffer.length < 4 + len) break;
    const body = buffer.subarray(4, 4 + len);
    buffer = buffer.subarray(4 + len);
    try {
      const msg = JSON.parse(body.toString("utf-8"));
      handleMessage(msg);
    } catch (e) {
      console.error("[TCP] Lỗi parse frame JSON:", e.message);
    }
  }
});

socket.on("close", () => {
  console.log("\n[TCP] Kết nối tới server đã đóng. Nhấn Ctrl+C để thoát.");
  process.exit(0);
});

socket.on("error", (err) => {
  console.error(`\n[TCP Error] ${err.message}`);
});

// Heartbeat ping
setInterval(() => {
  if (!socket.destroyed) send({ type: "ping" });
}, 10_000);

function handleMessage(msg) {
  if (msg.type === "pong") return;

  if (msg.type === "welcome") {
    myUserId = msg.id;
    myName = msg.name || "Người chơi";
    console.log(`[Chào mừng] Bạn đã đăng nhập thành công! ID: ${myUserId} | Tên: ${myName}`);
    printHelp();
  } else if (msg.type === "renamed") {
    myName = msg.name;
    console.log(`[Thông báo] Bạn đã đổi tên thành công thành: ${myName}`);
  } else if (msg.type === "notice") {
    console.log(`\n📢 [Thông báo]: ${msg.message}`);
  } else if (msg.type === "error") {
    console.log(`\n❌ [Lỗi]: ${msg.message}`);
  } else if (msg.type === "lobby") {
    if (!currentRoom) {
      console.log(`[Sảnh chờ] Đang online: ${msg.online} | Đang tìm trận: ${msg.matching || 0} | Số phòng: ${msg.rooms?.length || 0}`);
    }
  } else if (msg.type === "invitation") {
    console.log(`\n🔔 [LỜI MỜI THÁCH ĐẤU]`);
    console.log(`   Từ người chơi: ${msg.fromName} (ID: ${msg.fromId})`);
    console.log(`   Nhập: accept ${msg.id}  (để đồng ý) hoặc  decline ${msg.id}  (để từ chối)`);
  } else if (msg.type === "drawOfferReceived") {
    console.log(`\n🤝 [CẦU HÒA] Đối thủ ${msg.fromName} đề nghị HÒA ván cờ.`);
    console.log(`   Nhập: draw-yes (đồng ý hòa) hoặc draw-no (từ chối hòa)`);
  } else if (msg.type === "matchmaking") {
    if (msg.waiting) console.log("⏳ Đang tìm đối thủ trong hàng chờ... (gõ 'cancel' để hủy)");
  } else if (msg.type === "left") {
    currentRoom = null;
    console.log("👋 Bạn đã rời khỏi phòng chơi.");
  } else if (msg.type === "room") {
    currentRoom = msg.room;
    renderBoard(msg.room);
  }
}

function renderBoard(room) {
  console.log("\n========================================================");
  console.log(`PHÒNG: ${room.id} | TRẠNG THÁI: ${room.status.toUpperCase()}`);
  
  const p1 = room.players[0] ? `${room.players[0].name} (X)` : "Chờ...";
  const p2 = room.players[1] ? `${room.players[1].name} (O)` : "Chờ...";
  console.log(`Người chơi: [X] ${p1}  vs  [O] ${p2}`);

  if (room.status === "playing") {
    console.log(`👉 LƯỢT ĐÁNH: Quân ${room.turn} | Thời gian còn lại: ${room.deadline ? Math.max(0, Math.round((room.deadline - Date.now()) / 1000)) + "s" : "..."}`);
  } else if (room.status === "finished") {
    if (room.winner) {
      const winnerName = room.players.find((p) => p.id === room.winner)?.name || "Người chơi";
      console.log(`🏆 KẾT QUẢ: ${winnerName} CHIẾN THẮNG! (Lý do: ${room.reason || "5 quân"})`);
    } else {
      console.log(`🤝 KẾT QUẢ: HÒA VÁN CỜ! (Lý do: ${room.reason || "Thỏa thuận"})`);
    }
  }

  // Draw 15x15 board
  let header = "    ";
  for (let c = 1; c <= 15; c++) header += String(c).padStart(2, "0") + " ";
  console.log(header);

  for (let r = 0; r < 15; r++) {
    let rowStr = String(r + 1).padStart(2, "0") + "  ";
    for (let c = 0; c < 15; c++) {
      const idx = r * 15 + c;
      const cell = room.board[idx];
      rowStr += (cell ? " " + cell : " ·") + " ";
    }
    console.log(rowStr);
  }
  console.log("========================================================");
}

function printHelp() {
  console.log(`
DANH SÁCH LỆNH CONSOLE TCP:
  name <tên>          : Đổi tên hiển thị
  match               : Tìm trận ngẫu nhiên
  cancel              : Hủy tìm trận
  create              : Tự tạo phòng riêng
  join <mã_phòng>     : Vào phòng bằng mã 6 ký tự
  <hàng> <cột>        : Đánh nước cờ (ví dụ: 8 8)
  chat <nội dung>     : Gửi tin nhắn chat trong phòng
  draw                : Đề nghị hòa cờ
  draw-yes / draw-no  : Đồng ý hoặc từ chối đề nghị hòa
  resign              : Đầu hàng
  rematch             : Đề nghị chơi lại
  leave               : Rời phòng
  list                : Xem danh sách người chơi online
  invite <id_người>   : Mời người chơi khác thi đấu
  help                : Xem lại danh sách lệnh
`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Caro> ",
});

rl.prompt();

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) {
    rl.prompt();
    return;
  }

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd === "help") {
    printHelp();
  } else if (cmd === "name") {
    const newName = parts.slice(1).join(" ");
    if (newName) send({ type: "rename", name: newName });
    else console.log("Cú pháp: name <tên>");
  } else if (cmd === "match") {
    send({ type: "match", name: myName });
  } else if (cmd === "cancel") {
    send({ type: "cancelMatch" });
  } else if (cmd === "create") {
    send({ type: "create", name: myName });
  } else if (cmd === "join") {
    if (parts[1]) send({ type: "join", name: myName, roomId: parts[1].toUpperCase() });
    else console.log("Cú pháp: join <mã_phòng>");
  } else if (cmd === "move") {
    handleMoveCommand(parts[1], parts[2]);
  } else if (!isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
    handleMoveCommand(parts[0], parts[1]);
  } else if (cmd === "chat") {
    const chatText = parts.slice(1).join(" ");
    if (chatText) send({ type: "chat", text: chatText });
    else console.log("Cú pháp: chat <nội dung>");
  } else if (cmd === "draw") {
    send({ type: "drawOffer" });
  } else if (cmd === "draw-yes") {
    send({ type: "drawResponse", accept: true });
  } else if (cmd === "draw-no") {
    send({ type: "drawResponse", accept: false });
  } else if (cmd === "resign") {
    send({ type: "resign" });
  } else if (cmd === "rematch") {
    send({ type: "rematch" });
  } else if (cmd === "leave") {
    send({ type: "leave" });
  } else if (cmd === "list") {
    send({ type: "stats" });
  } else if (cmd === "invite") {
    if (parts[1]) send({ type: "invite", targetUserId: parts[1], name: myName });
    else console.log("Cú pháp: invite <user_id>");
  } else if (cmd === "accept") {
    if (parts[1]) send({ type: "inviteResponse", invitationId: parts[1], accept: true });
    else console.log("Cú pháp: accept <invitation_id>");
  } else if (cmd === "decline") {
    if (parts[1]) send({ type: "inviteResponse", invitationId: parts[1], accept: false });
    else console.log("Cú pháp: decline <invitation_id>");
  } else {
    console.log(`Lệnh không nhận diện: '${cmd}'. Gõ 'help' để xem các lệnh.`);
  }

  rl.prompt();
});

function handleMoveCommand(rowStr, colStr) {
  const row = Number(rowStr);
  const col = Number(colStr);
  if (isNaN(row) || isNaN(col) || row < 1 || row > 15 || col < 1 || col > 15) {
    console.log("Tọa độ không hợp lệ! Hàng và Cột từ 1 đến 15 (ví dụ: 8 8).");
    return;
  }
  const index = (row - 1) * 15 + (col - 1);
  send({ type: "move", index });
}

