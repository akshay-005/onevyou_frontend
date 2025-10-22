import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// ================================
// ✅ SafeEmit Global Setup
// ================================
let socketInstance: Socket | null = null;

/**
 * Safe emit that retries once if socket isn't ready.
 * 🧠 Enhancement: automatically injects socket.myUserId (if available)
 */
export const safeEmit = (event: string, data: any = {}) => {
  if (socketInstance && (socketInstance as any).myUserId) {
    data.userId = data.userId || (socketInstance as any).myUserId;
  }

  if (socketInstance && socketInstance.connected) {
    socketInstance.emit(event, data);
  } else {
    console.warn(`⚠️ Socket not ready, delaying emit: ${event}`);
    setTimeout(() => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit(event, data);
        console.log(`✅ Retried emit: ${event}`);
      } else {
        console.warn(`🚫 Still not connected — giving up on ${event}`);
      }
    }, 1000);
  }
};

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
    if (socketInstance) {
      console.log("⚙️ Socket already connected, skipping new init");
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

    // 🆕 Attach userId immediately
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      (s as any).myUserId = storedUserId;
      console.log("🧠 Loaded myUserId into socket:", storedUserId);
    } else {
      console.warn("⚠️ No userId found in localStorage yet — will attach later");
    }

    socketInstance = s;

    // 🆕 Dynamically attach userId later if login happens after socket init
    window.addEventListener("storage", () => {
      const newId = localStorage.getItem("userId");
      if (newId && socketInstance && !(socketInstance as any).myUserId) {
        (socketInstance as any).myUserId = newId;
        console.log("🧩 userId attached dynamically:", newId);
      }
    });

    // 🧩 Handle successful connection or reconnection
    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);

      // Ensure userId exists
      const userId = (s as any).myUserId || localStorage.getItem("userId");
      if (userId) (s as any).myUserId = userId;

      // Restore last known online state
      const savedOnlineState = localStorage.getItem("isOnline");
      const isOnline = savedOnlineState ? JSON.parse(savedOnlineState) : true;

      if (userId) {
        safeEmit("user:status:update", { userId, isOnline });
        console.log("🔄 Restored online state:", isOnline);
      } else {
        console.warn("⚠️ Still missing userId — cannot emit status update");
      }
    });

    // ✅ Notify when socket automatically reconnects
    s.on("reconnect", (attemptNumber) => {
      console.log(`♻️ Socket reconnected after drop (attempt ${attemptNumber})`);
      if (typeof window !== "undefined") {
        const event = new CustomEvent("app-toast", {
          detail: {
            title: "Reconnected",
            description: "Connection restored automatically",
          },
        });
        window.dispatchEvent(event);
      }
    });

    // ⚙️ Generic listeners
    s.on("disconnect", (reason) => console.log("⚠️ Socket disconnected:", reason));
    s.on("connect_error", (err) => console.error("🚫 Socket connect_error:", err.message || err));

    setSocket(s);

    // ✅ Cleanup (keep socket alive globally)
    return () => {
      console.log("🧹 Cleaning up Socket.IO listeners (NOT disconnecting)");
      s.removeAllListeners();
      socketInstance = s;
    };
  }, []); // ✅ Run only once

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
