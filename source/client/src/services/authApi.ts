import type { Account } from "../types";

type AuthResponse = { account: Account | null; message?: string };

async function readResponse(response: Response): Promise<AuthResponse> {
  const data = (await response.json()) as AuthResponse;
  if (!response.ok) throw new Error(data.message || "Không thể xử lý tài khoản.");
  return data;
}

export async function getCurrentAccount(): Promise<Account | null> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  return (await readResponse(response)).account;
}

export async function authenticate(
  mode: "login" | "register",
  username: string,
  password: string,
): Promise<Account> {
  const response = await fetch(`/api/auth/${mode}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Caro-Request": "1",
    },
    body: JSON.stringify({ username, password }),
  });
  const account = (await readResponse(response)).account;
  if (!account) throw new Error("Server không trả về thông tin tài khoản.");
  return account;
}

export async function endSession(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Caro-Request": "1" },
  });
  if (!response.ok) throw new Error("Không thể đăng xuất.");
}
