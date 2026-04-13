const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    socket.to(roomId).emit("user-joined", socket.id);
  });

  // VIDEO SYNC
  socket.on("video-event", (data) => {
    socket.to(data.roomId).emit("video-event", data);
  });

  // WEBRTC SIGNALING
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
server.listen(PORT, () => console.log("Running on " + PORT));
