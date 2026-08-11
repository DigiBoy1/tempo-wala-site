
// app.js
//
// ↓↓↓ THE ONLY LINE YOU NEED TO EDIT ↓↓↓
const BACKEND_URL = "https://tempo-wala.onrender.com";
// ↑↑↑ THE ONLY LINE YOU NEED TO EDIT ↑↑↑
 
var socket = io(BACKEND_URL);
var player = null;
var pendingSync = null;
 
// --- Live clock ---
function updateClock() {
  var now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();
 
// --- Live user count ---
socket.on("userCount", function (count) {
  document.getElementById("userCount").textContent = count;
});
 
// --- Sync events from the server ---
socket.on("sync", function (data) {
  if (!player || typeof player.loadVideoById !== "function") {
    pendingSync = data;
    return;
  }
  applySync(data);
});
 
function applySync(data) {
  player.loadVideoById({ videoId: data.videoId, startSeconds: data.elapsed });
}
 
// --- YouTube IFrame API setup ---
window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player("player", {
    height: "1",
    width: "1",
    videoId: "",
    playerVars: { autoplay: 0, controls: 0 },
    events: {
      onReady: function () {
        if (pendingSync) {
          applySync(pendingSync);
          pendingSync = null;
        }
      },
    },
  });
};
 
// --- Tap-to-join button ---
document.getElementById("joinBtn").addEventListener("click", function () {
  if (player && typeof player.playVideo === "function") {
    player.playVideo();
  }
  document.getElementById("joinBtn").classList.add("hidden");
  document.getElementById("dock").hidden = false;
});
 
