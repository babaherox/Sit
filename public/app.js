const socket = io();

let roomId;
let player;

// ---- VOICE CHAT ----
let localStream;
let peers = {};

// STUN server (WebRTC için)
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// =======================
// JOIN ROOM
// =======================
function joinRoom() {
  roomId = document.getElementById("roomInput").value;

  if (!roomId) {
    alert("Room ID yaz!");
    return;
  }

  socket.emit("join-room", roomId);
  startMic();
}

// =======================
// YOUTUBE PLAYER LOAD
// =======================
function loadVideo() {
  const url = document.getElementById("ytInput").value;
  const videoId = extractVideoId(url);

  if (!videoId) {
    alert("Geçerli YouTube link gir!");
    return;
  }

  // player yoksa oluştur
  if (!player) {
    player = new YT.Player("player", {
      height: "450",
      width: "800",
      videoId: videoId
    });
  } else {
    player.loadVideoById(videoId);
  }
}

// YouTube link parse
function extractVideoId(url) {
  if (!url) return null;

  let match = url.match(/v=([^&]+)/);
  if (match) return match[1];

  match = url.match(/youtu\.be\/([^?]+)/);
  if (match) return match[1];

  return url; // direkt id girilirse
}

// =======================
// VIDEO CONTROL
// =======================
function playVideo() {
  if (!player) return;

  player.playVideo();

  socket.emit("video-event", {
    roomId,
    type: "play",
    time: player.getCurrentTime()
  });
}

function pauseVideo() {
  if (!player) return;

  player.pauseVideo();

  socket.emit("video-event", {
    roomId,
    type: "pause",
    time: player.getCurrentTime()
  });
}

// Sync diğer kullanıcılar
socket.on("video-event", (data) => {
  if (!player) return;

  if (data.type === "play") player.playVideo();
  if (data.type === "pause") player.pauseVideo();
});

// =======================
// FULLSCREEN
// =======================
function toggleFullscreen() {
  const el = document.getElementById("playerContainer");

  if (!document.fullscreenElement) {
    el.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// =======================
// VOICE CHAT (WEBRTC)
// =======================
async function startMic() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    setupSocketEvents();
  } catch (err) {
    alert("Mikrofon izni vermedin!");
    console.error(err);
  }
}

// socket voice events
function setupSocketEvents() {

  socket.on("user-joined", (id) => {
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

// Peer oluştur
function createPeer(id, isInitiator) {
  const peer = new RTCPeerConnection(config);
  peers[id] = peer;

  // mikrofon ekle
  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream);
  });

  // ses al
  peer.ontrack = (event) => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    audio.controls = false;
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

  // offer gönder
  if (isInitiator) {
    peer.createOffer().then(async (offer) => {
      await peer.setLocalDescription(offer);

      socket.emit("offer", {
        to: id,
        offer
      });
    });
  }

  return peer;
}

// =======================
// MIC TOGGLE
// =======================
function toggleMic() {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
}
