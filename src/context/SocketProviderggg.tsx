import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
  const token = localStorage.getItem("userToken");
  if (!token) {
    console.warn("⚠️ No token found. Socket will not connect until user logs in.");
    return;
  }

  // Prevent reconnecting if socket already exists
  if (socket) {
    console.log("🔄 Socket already connected, skipping reinit.");
    return;
  }

  const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/api\/?$/, "");
  console.log("🔌 Connecting Socket.IO to:", baseURL);

  const s = io(baseURL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    autoConnect: true,
  });

  s.on("connect", () => console.log("✅ Socket connected:", s.id));
  s.on("connect_error", (err) => console.error("🚫 Socket error:", err.message));
  s.on("disconnect", (r) => console.log("⚠️ Socket disconnected:", r));

  setSocket(s);

  // ❌ Remove automatic disconnect on unmount (keep socket alive)
  // return () => {
  //   console.log("🧹 Cleaning up Socket.IO");
  //   s.removeAllListeners();
  //   s.disconnect();
  //   setSocket(null);
  // };
}, []); // ← only run once for whole app

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
