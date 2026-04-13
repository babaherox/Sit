const socket = io();

let roomId;
let player;
let localStream;
let peers = {};

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// =====================
// ROOM
// =====================
function joinRoom() {
  roomId = document.getElementById("roomInput").value;

  if (!roomId) return alert("Room ID gir");

  socket.emit("join-room", roomId);
  startMic();
}

// =====================
// YOUTUBE READY FIX
// =====================
let pendingVideoId = null;

window.onYouTubeIframeAPIReady = () => {
  console.log("YouTube API Ready");

  if (pendingVideoId) {
    createPlayer(pendingVideoId);
  }
};

function extractVideoId(url) {
  let match = url.match(/v=([^&]+)/);
  if (match) return match[1];

  match = url.match(/youtu\.be\/([^?]+)/);
  if (match) return match[1];

  return url;
}

function loadVideo() {
  const url = document.getElementById("ytInput").value;
  const videoId = extractVideoId(url);

  if (!videoId) return alert("Geçerli link gir");

  if (typeof YT === "undefined") {
    pendingVideoId = videoId;
    return;
  }

  if (!player) {
    createPlayer(videoId);
  } else {
    player.loadVideoById(videoId);
  }
}

function createPlayer(videoId) {
  player = new YT.Player("player", {
    height: "500",
    width: "900",
    videoId,
    playerVars: {
      autoplay: 0,
      controls: 1
    }
  });
}

// =====================
// VIDEO CONTROL (SYNC)
// =====================
function playVideo() {
  if (!player) return;
  player.playVideo();

  socket.emit("video-event", {
    roomId,
    type: "play"
  });
}

function pauseVideo() {
  if (!player) return;
  player.pauseVideo();

  socket.emit("video-event", {
    roomId,
    type: "pause"
  });
}

socket.on("video-event", (data) => {
  if (!player) return;

  if (data.type === "play") player.playVideo();
  if (data.type === "pause") player.pauseVideo();
});

// =====================
// FULLSCREEN
// =====================
function toggleFullscreen() {
  const el = document.getElementById("playerContainer");

  if (!document.fullscreenElement) {
    el.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// =====================
// VOICE CHAT (WEBRTC)
// =====================
async function startMic() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    setupSocket();
  } catch (e) {
    alert("Mic izin vermedin");
  }
}

function setupSocket() {

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

function createPeer(id, initiator) {
  const peer = new RTCPeerConnection(config);
  peers[id] = peer;

  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream);
  });

  peer.ontrack = (event) => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("ice-candidate", {
        to: id,
        candidate: e.candidate
      });
    }
  };

  if (initiator) {
    peer.createOffer().then(async offer => {
      await peer.setLocalDescription(offer);

      socket.emit("offer", {
        to: id,
        offer
      });
    });
  }

  return peer;
}

// =====================
// MIC TOGGLE
// =====================
function toggleMic() {
  if (!localStream) return;

  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}
