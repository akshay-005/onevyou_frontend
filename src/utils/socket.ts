// frontend/src/utils/socket.ts
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// ================================
// ✅ SafeEmit Global Setup
// ================================
let socketInstance: Socket | null = null;

export const safeEmit = (event: string, data?: any) => {
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

    socketInstance = s; 

// ✅ Auto-resync user online status after reconnection
s.on("connect", () => {
  console.log("🔌 Socket reconnected successfully:", s.id);
  const userId = localStorage.getItem("userId");

  // 🧠 Read saved state from localStorage (default true)
  const savedOnlineState = localStorage.getItem("isOnline");
  const isOnline = savedOnlineState ? JSON.parse(savedOnlineState) : true;

  if (userId) {
    safeEmit("user:status:update", { userId, isOnline });
  }

  console.log(`🔄 Restored online state: ${isOnline}`);
});



// ✅ BONUS: Notify when socket automatically reconnects after a temporary drop
s.on("reconnect", (attemptNumber) => {
  console.log(`♻️ Socket reconnected after drop (attempt ${attemptNumber})`);
  // Optional visual feedback — you can remove if not needed
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




    s.on("connect", () => console.log("✅ Socket connected:", s.id));
    s.on("disconnect", (reason) => console.log("⚠️ Socket disconnected:", reason));
    s.on("connect_error", (err) => console.error("🚫 Socket connect_error:", err.message || err));

    setSocket(s);

    // ✅ Cleanup when provider unmounts or token changes
    return () => {
  console.log("🧹 Cleaning up Socket.IO listeners (NOT disconnecting)");
  s.removeAllListeners();     // remove old listeners
  // ❌ don't disconnect socket here, keep it alive
  socketInstance = s;         // keep global instance alive
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
