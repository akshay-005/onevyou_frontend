// frontend/src/utils/socket.ts
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// Create Socket context
const SocketContext = createContext<Socket | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: ProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);

 useEffect(() => {
  const token = localStorage.getItem("userToken");
  if (!token) {
    console.warn("⚠️ No token found. Socket connection skipped.");
    return;
  }

  const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/api\/?$/, "");
  console.log("🔌 Connecting to Socket.IO server:", baseURL);

  // Prevent reconnecting if already set
  if (socket) {
    console.log("⚙️ Socket already exists, skipping reinit");
    return;
  }

  const s = io(baseURL, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
  });

  s.on("connect", () => console.log("✅ Socket connected:", s.id));
  s.on("disconnect", (reason) => console.log("⚠️ Socket disconnected:", reason));
  s.on("connect_error", (err) => console.error("🚫 Socket connect_error:", err.message || err));

  setSocket(s);

  // 🚫 Keep socket alive — remove disconnect on unmount
  // return () => {
  //   console.log("🧹 Cleaning up Socket.IO connection");
  //   s.removeAllListeners();
  //   s.disconnect();
  //   setSocket(null);
  // };
}, []); // run only once


  // ✅ Use createElement instead of JSX since we're in a `.ts` file
  return React.createElement(SocketContext.Provider, { value: socket }, children);
};

export const useSocket = (): Socket | null => {
  const socket = useContext(SocketContext);
  if (socket === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return socket;
};
