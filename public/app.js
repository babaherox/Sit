const socket = io();

let roomId;
let player;

// ---- VOICE ----
let localStream;
let peers = {}; // socketId -> RTCPeerConnection

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// ---- JOIN ROOM ----
function joinRoom() {
  roomId = document.getElementById("roomInput").value;
  socket.emit("join-room", roomId);

  startMic();
}

// ---- MIC ----
async function startMic() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  socket.on("user-joined", async (id) => {
    createPeer(id, true);
  });

  socket.on("offer", async (data) => {
    const peer = createPeer(data.from, false);
    await peer.setRemoteDescription(data.offer);

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answer", {
      to: data.from,
      answer
    });
  });

  socket.on("answer", async (data) => {
    await peers[data.from].setRemoteDescription(data.answer);
  });

  socket.on("ice-candidate", async (data) => {
    if (peers[data.from]) {
      await peers[data.from].addIceCandidate(data.candidate);
    }
  });
}

// ---- PEER CONNECTION ----
function createPeer(id, isInitiator) {
  const peer = new RTCPeerConnection(config);
  peers[id] = peer;

  // mic stream ekle
  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream);
  });

  // audio al
  peer.ontrack = (event) => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  // ICE
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: id,
        candidate: event.candidate
      });
    }
  };

  // offer
  if (isInitiator) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.emit("offer", {
        to: id,
        offer
      });
    });
  }

  return peer;
}

// ---- MIC TOGGLE ----
function toggleMic() {
  localStream.getAudioTracks()[0].enabled =
    !localStream.getAudioTracks()[0].enabled;
}

// ---- YOUTUBE ----
function loadVideo() {
  const url = document.getElementById("ytInput").value;
  const videoId = url.split("v=")[1].split("&")[0];

  player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId
  });
}

function playVideo() {
  player.playVideo();
  socket.emit("video-event", { roomId, type: "play" });
}

function pauseVideo() {
  player.pauseVideo();
  socket.emit("video-event", { roomId, type: "pause" });
}

// ---- SYNC ----
socket.on("video-event", (data) => {
  if (!player) return;

  if (data.type === "play") player.playVideo();
  if (data.type === "pause") player.pauseVideo();
});
