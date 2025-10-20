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

    // ✅ No token → Disconnect any existing socket
    if (!token) {
      console.warn("⚠️ No token found. Disconnecting existing socket...");
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/api\/?$/, "");
    console.log("🔌 Connecting to Socket.IO server:", baseURL);

    // ✅ Prevent duplicate connections
    if (socket) {
      console.log("⚙️ Socket already exists, skipping reinit");
      return;
    }

    // ✅ Create new socket with session-based unique ID
    const s = io(baseURL, {
      auth: { token },
      query: { session: Date.now().toString() }, // force fresh session
      transports: ["websocket"],
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

    // ✅ Cleanup when provider unmounts or token changes
    return () => {
      console.log("🧹 Cleaning up Socket.IO connection");
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, []); // ✅ Run only once on moun

  // ✅ Provide socket to all components
  return React.createElement(SocketContext.Provider, { value: socket }, children);
};

// Hook to use socket anywhere
export const useSocket = (): Socket | null => {
  const socket = useContext(SocketContext);
  if (socket === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return socket;
};
