// app.js
//
// ↓↓↓ THE ONLY LINE YOU NEED TO EDIT ↓↓↓
// After you deploy the backend (step in README), paste its URL here.
const BACKEND_URL = "https://tempo-wala.onrender.com";
// ↑↑↑ THE ONLY LINE YOU NEED TO EDIT ↑↑↑

const socket = io(BACKEND_URL);
let player;
let pendingSync = null;

// --- Live clock (top-left, just cosmetic like the screenshot) ---
function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();

// --- Live user count ---
socket.on("userCount", (count) => {
  document.getElementById("userCount").textContent = count;
});

// --- Sync events from the server (which song, how far into it) ---
socket.on("sync", (data) => {
  if (!player || !player.loadVideoById) {
    pendingSync = data; // player isn't ready yet, save it for when it loads
    return;
  }
  applySync(data);
});

function applySync(data) {
  player.loadVideoById({ videoId: data.videoId, startSeconds: data.elapsed });
}

// --- YouTube IFrame API setup ---
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "1",
    width: "1",
    videoId: "",
    playerVars: { autoplay: 0, controls: 0 },
    events: {
      onReady: () => {
        if (pendingSync) {
          applySync(pendingSync);
          pendingSync = null;
        }
      },
    },
  });
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

// --- Tap-to-join button (needed because browsers block autoplay with sound) ---
document.getElementById("joinBtn").addEventListener("click", () => {
  if (player && player.playVideo) {
    player.playVideo();
  }
  document.getElementById("joinBtn").classList.add("hidden");
  document.getElementById("dock").hidden = false;
});
