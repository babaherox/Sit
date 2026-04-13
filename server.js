const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

io.on("connection", (socket) => {

  // 🏠 ROOM CREATE
  socket.on("create-room", () => {
    const roomId = generateRoomId();
    rooms[roomId] = true;

    socket.join(roomId);
    socket.roomId = roomId;

    // 🔥 INVITE LINK GÖNDER
    socket.emit("room-created", {
      roomId,
      link: `/room/${roomId}`
    });
  });

  // 🔑 ROOM JOIN
  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) {
      socket.emit("room-error", "Oda yok");
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;

    socket.emit("room-joined", roomId);
    socket.to(roomId).emit("user-joined", socket.id);
  });

  // VIDEO SYNC
  socket.on("video-event", (data) => {
    socket.to(data.roomId).emit("video-event", data);
  });

  // WEBRTC
  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", {
      from: socket.id,
      offer: data.offer
    });
  });

  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", {
      from: socket.id,
      answer: data.answer
    });
  });

  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", {
      from: socket.id,
      candidate: data.candidate
    });
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Running"));
