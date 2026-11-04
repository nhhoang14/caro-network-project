import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
  rooms: <><rect x="3" y="4" width="7" height="7" rx="2" /><rect x="14" y="4" width="7" height="7" rx="2" /><rect x="3" y="15" width="7" height="6" rx="2" /><path d="M14 18h7m-3.5-3.5v7" /></>,
  history: <path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2" />,
  book: <><path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-3-1-6-2-10 1Z" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  send: <><path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" /></>,
  chat: <path d="M21 11a8 8 0 0 1-8 8H7l-5 3 1-7a8 8 0 1 1 18-4Z" />,
  undo: <><path d="M9 4 3 10l6 6M3 10h11a7 7 0 0 1 7 7v3" /></>,
  flag: <><path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  volume: <><path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  mute: <><path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l6 6m0-6-6 6" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
  shield: <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  trophy: <><path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 14v6m-4 1h8" /></>,
  link: <><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" /></>,
  exit: <><path d="M9 3H4v18h5m6-14 5 5-5 5m-6-5h11" /></>,
  bot: <><rect x="4" y="6" width="16" height="14" rx="4" /><path d="M12 2v4M1 11v5m22-5v5M8 16h8" /><circle cx="8" cy="11" r=".7" /><circle cx="16" cy="11" r=".7" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  shuffle: <><path d="M3 7h4c5 0 5 10 10 10h4m-4-4 4 4-4 4M3 17h4c2 0 3-2 4-4m3-2c1-2 2-4 3-4h4m-4-4 4 4-4 4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  handshake: <path d="M11 17l2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0L12 13 M18 11l3-3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0l-5 5 M2 13l4.3 4.3a1 1 0 0 0 1.4 0l3-3" />,
  edit: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.grid}
    </svg>
  );
}

export function Mark({ symbol, small = false }: { symbol: "X" | "O"; small?: boolean }) {
  return <span aria-hidden="true" className={`mark mark-${symbol.toLowerCase()} ${small ? "small" : ""}`} />;
}
