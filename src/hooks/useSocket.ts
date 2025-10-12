// src/hooks/useSocket.ts
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export default function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    const url = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";
    const socket = io(url, { transports: ["websocket"] });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("authenticate", { token });
    });

    socket.on("unauthorized", () => {
      console.warn("Socket unauthorized");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef; // hook returns a ref; .current may be null initially
}
