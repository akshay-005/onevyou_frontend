import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";


const FanDashboard = () => {
  const socket = useSocket();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // listen for online/offline status updates
    socket.on("user:status", (data) => {
      setOnlineUsers((prev) => {
        const existing = prev.find((u) => u.userId === data.userId);
        if (existing) {
          return prev.map((u) =>
            u.userId === data.userId ? { ...u, ...data } : u
          );
        } else {
          return [...prev, data];
        }
      });
    });

    return () => {
      socket.off("user:status");
    };
  }, [socket]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>🎉 Fan Dashboard</h2>
      <h3>Online Users</h3>
      <ul>
        {onlineUsers.map((user) => (
          <li key={user.userId}>
            User: {user.userId} ✅ Online since:{" "}
            {new Date(user.onlineSince).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FanDashboard;
