import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";


const CreatorDashboard = () => {
  const socket = useSocket();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen when fans join or go online
    socket.on("user:status", (data) => {
      setEvents((prev) => [...prev, `User ${data.userId} is ${data.online ? "online" : "offline"}`]);
    });

    return () => {
      socket.off("user:status");
    };
  }, [socket]);

  const sendMessage = () => {
    if (socket) {
      socket.emit("creator:message", { text: "Hello Fans 👋" });
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>🎬 Creator Dashboard</h2>

      <button onClick={sendMessage}>📢 Send Message to Fans</button>

      <h3>Events</h3>
      <ul>
        {events.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
};

export default CreatorDashboard;
