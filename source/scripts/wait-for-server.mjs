const port = process.env.BACKEND_PORT || process.env.PORT || "8000";
const healthUrl = `http://127.0.0.1:${port}/health`;
const deadline = Date.now() + 120_000;

console.log(`Đang chờ Spring Boot sẵn sàng tại ${healthUrl}...`);

while (Date.now() < deadline) {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(1_000),
    });
    if (response.ok) {
      console.log("Spring Boot đã sẵn sàng. Đang khởi động Vite...");
      process.exit(0);
    }
  } catch {
    // Backend is still compiling, starting, or connecting to MongoDB.
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
}

console.error(
  `Spring Boot chưa sẵn sàng sau 120 giây. Kiểm tra log Maven, MongoDB URI và Atlas Network Access.`,
);
process.exit(1);
