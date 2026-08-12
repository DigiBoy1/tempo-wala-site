// app.js
const BACKEND_URL = "https://tempo-wala.onrender.com";

var socket = io(BACKEND_URL);
var player = null;
var pendingSync = null;

// --- Clock + date ---
function updateClock() {
  var now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  document.getElementById("dateLine").textContent =
    now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}
setInterval(updateClock, 1000);
updateClock();

// --- Live user count ---
socket.on("userCount", function (count) {
  document.getElementById("userCount").textContent = count;
});

// --- Sync events from the server ---
socket.on("sync", function (data) {
  updateNowPlaying(data);
  if (!player || typeof player.loadVideoById !== "function") {
    pendingSync = data;
    return;
  }
  applySync(data);
});

function applySync(data) {
  player.loadVideoById({ videoId: data.videoId, startSeconds: data.elapsed });
}

// Splits a YouTube title like "Song Name - Artist Name" into two parts.
// Falls back gracefully if there's no dash.
function splitTitle(rawTitle) {
  if (!rawTitle) return { song: "—", artist: "—" };
  var parts = rawTitle.split(/\s-\s|\s\|\s/);
  if (parts.length >= 2) {
    return { song: parts[0].trim(), artist: parts.slice(1).join(" - ").trim() };
  }
  return { song: rawTitle.trim(), artist: "Nitinsinghverse Radio" };
}

function updateNowPlaying(data) {
  var split = splitTitle(data.title);
  var titleEl = document.getElementById("songTitle");
  var artistEl = document.getElementById("songArtist");
  var artEl = document.getElementById("albumArt");

  if (titleEl) titleEl.textContent = split.song;
  if (artistEl) artistEl.textContent = split.artist;
  if (artEl && data.videoId) {
    artEl.src = "https://img.youtube.com/vi/" + data.videoId + "/hqdefault.jpg";
  }
  if (data.title) {
    document.title = data.title + " — Nitinsinghverse";
  }
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
        // apply whatever volume the slider currently shows
        var slider = document.getElementById("volumeSlider");
        if (slider) player.setVolume(parseInt(slider.value, 10));
      },
    },
  });
};

// --- Volume slider (local only — doesn't affect other listeners) ---
document.getElementById("volumeSlider").addEventListener("input", function (e) {
  if (player && typeof player.setVolume === "function") {
    player.setVolume(parseInt(e.target.value, 10));
  }
});

// --- Tap-to-join button ---
document.getElementById("joinBtn").addEventListener("click", function () {
  if (player && typeof player.playVideo === "function") {
    player.playVideo();
  }
  document.getElementById("joinBtn").classList.add("hidden");
  document.getElementById("dock").hidden = false;
});