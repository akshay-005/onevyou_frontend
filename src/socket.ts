import { io, Socket } from "socket.io-client";

let socket: Socket;

export const connectSocket = (token: string) => {
  socket = io(import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001", {
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("Connected to socket:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from socket");
  });

  socket.on("user:status", (data) => {
    console.log("User status changed:", data);
    // You will update frontend state later based on this
  });

  return socket;
};

export const getSocket = () => socket;
