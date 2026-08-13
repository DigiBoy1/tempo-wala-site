// app.js
const BACKEND_URL = "https://tempo-wala.onrender.com";

var socket = io(BACKEND_URL);
var player = null;
var pendingSync = null;
var isAdmin = false;
var activePlaylistKey = null;
var trackDuration = 0;
var trackElapsedAtSync = 0;
var syncReceivedAt = Date.now();

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

// --- Admin online/offline badge + request box visibility ---
socket.on("adminStatus", function (data) {
  document.getElementById("adminLiveBadge").hidden = !data.online;
  document.getElementById("requestBox").hidden = !data.online;
});

socket.on("upNext", function (data) {
  var banner = document.getElementById("upNextBanner");
  banner.textContent = "🎵 Coming up: " + data.title;
  banner.hidden = false;
  setTimeout(function () {
    banner.hidden = true;
  }, (data.seconds || 10) * 1000);
});

// --- Sync events (which song is playing right now) ---
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

// Continuous drift-correction — no reload, just a quiet seek if this device
// has fallen out of step with everyone else.
socket.on("resync", function (data) {
  if (!player || typeof player.getCurrentTime !== "function") return;
  try {
    var current = player.getVideoData();
    if (!current || current.video_id !== data.videoId) return; // different song, ignore
    trackElapsedAtSync = data.elapsed;
    syncReceivedAt = Date.now();
    var myTime = player.getCurrentTime();
    var drift = Math.abs(myTime - data.elapsed);
    if (drift > 0.6) {
      player.seekTo(data.elapsed, true);
    }
  } catch (e) {
    // player not ready yet — safe to ignore
  }
});

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
  var upNextEl = document.getElementById("upNextLine");

  if (titleEl) titleEl.textContent = split.song;
  if (artistEl) artistEl.textContent = split.artist;
  if (artEl && data.videoId) {
    artEl.src = "https://img.youtube.com/vi/" + data.videoId + "/hqdefault.jpg";
  }
  if (upNextEl) {
    upNextEl.textContent = data.upNextTitle ? "Up next: " + splitTitle(data.upNextTitle).song : "";
  }
  if (data.title) {
    document.title = data.title + " — Nitinsinghverse";
  }

  trackDuration = data.duration || 0;
  trackElapsedAtSync = data.elapsed || 0;
  syncReceivedAt = Date.now();
}

function getEstimatedElapsed() {
  return trackElapsedAtSync + (Date.now() - syncReceivedAt) / 1000;
}

function formatTime(s) {
  s = Math.max(0, Math.floor(s));
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

function updateProgressBar() {
  var fill = document.getElementById("progressFill");
  var timeText = document.getElementById("progressTime");
  if (!fill || !trackDuration) return;
  var elapsed = Math.min(getEstimatedElapsed(), trackDuration);
  var pct = (elapsed / trackDuration) * 100;
  fill.style.width = pct + "%";
  if (timeText) timeText.textContent = formatTime(elapsed) + " / " + formatTime(trackDuration);
}
setInterval(updateProgressBar, 1000);

// Admin can click/tap anywhere on the timeline to jump there — synced for everyone
var progressTrack = document.getElementById("progressTrack");
progressTrack.addEventListener("click", function (e) {
  if (!isAdmin || !trackDuration) return;
  var rect = progressTrack.getBoundingClientRect();
  var pct = (e.clientX - rect.left) / rect.width;
  pct = Math.min(Math.max(pct, 0), 1);
  var seekSeconds = Math.floor(pct * trackDuration);
  socket.emit("adminSeek", seekSeconds);
});

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
        var slider = document.getElementById("volumeSlider");
        if (slider) player.setVolume(parseInt(slider.value, 10));
      },
    },
  });
};

document.getElementById("volumeSlider").addEventListener("input", function (e) {
  if (player && typeof player.setVolume === "function") {
    player.setVolume(parseInt(e.target.value, 10));
  }
});

document.getElementById("joinBtn").addEventListener("click", function () {
  if (player && typeof player.playVideo === "function") {
    player.playVideo();
  }
  document.getElementById("joinBtn").classList.add("hidden");
  document.getElementById("dock").hidden = false;
});

// =====================================================
// ADMIN LOGIN
// =====================================================
var brandLogo = document.getElementById("brandLogo");
var adminModal = document.getElementById("adminModal");
var adminPasswordInput = document.getElementById("adminPasswordInput");
var adminError = document.getElementById("adminError");

brandLogo.addEventListener("click", function () {
  if (isAdmin) return; // already admin, nothing to do
  adminModal.hidden = false;
  adminError.hidden = true;
  adminPasswordInput.value = "";
  adminPasswordInput.focus();
});

document.getElementById("adminCancelBtn").addEventListener("click", function () {
  adminModal.hidden = true;
});

adminModal.addEventListener("click", function (e) {
  if (e.target === adminModal) {
    adminModal.hidden = true;
  }
});

document.getElementById("adminSubmitBtn").addEventListener("click", submitAdminLogin);
adminPasswordInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") submitAdminLogin();
});

function submitAdminLogin() {
  socket.emit("adminLogin", adminPasswordInput.value);
}

socket.on("adminLoginResult", function (res) {
  if (!res.success) {
    adminError.hidden = false;
    return;
  }
  isAdmin = true;
  adminModal.hidden = true;
  document.getElementById("adminPanel").hidden = false;
  document.getElementById("adminTransport").hidden = false;
  document.getElementById("progressTrack").classList.add("admin-mode");
  activePlaylistKey = res.currentPlaylistKey;
  renderPlaylistButtons(res.playlists);
  renderRequests(res.requests);
});

// If another device logs in as admin, this device gets demoted back to a normal listener
socket.on("adminDemoted", function () {
  isAdmin = false;
  document.getElementById("adminPanel").hidden = true;
  document.getElementById("adminTransport").hidden = true;
  document.getElementById("songListPanel").hidden = true;
  document.getElementById("progressTrack").classList.remove("admin-mode");
});

function renderPlaylistButtons(playlists) {
  var container = document.getElementById("playlistButtons");
  container.innerHTML = "";
  playlists.forEach(function (p) {
    var btn = document.createElement("button");
    btn.textContent = p.name;
    if (p.key === activePlaylistKey) btn.classList.add("active");
    btn.addEventListener("click", function () {
      Array.from(container.children).forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      socket.emit("adminSwitchPlaylist", p.key); // asks server for this playlist's song list
    });
    container.appendChild(btn);
  });
}

// Server replies with the song list for whichever playlist admin tapped
socket.on("playlistSongs", function (data) {
  var panel = document.getElementById("songListPanel");
  var list = document.getElementById("songListItems");
  list.innerHTML = "";
  data.songs.forEach(function (s) {
    var item = document.createElement("div");
    item.className = "song-list-item";
    item.textContent = splitTitle(s.title).song;
    item.addEventListener("click", function () {
      socket.emit("adminPlaySong", { key: data.key, index: s.index });
    });
    list.appendChild(item);
  });
  panel.hidden = false;
});

document.getElementById("prevBtn").addEventListener("click", function () {
  socket.emit("adminPrev");
});
document.getElementById("nextBtn").addEventListener("click", function () {
  socket.emit("adminNext");
});

document.getElementById("linkPlayBtn").addEventListener("click", function () {
  var input = document.getElementById("linkInput");
  var timeInput = document.getElementById("startTimeInput");
  if (!input.value.trim()) return;
  var startSeconds = parseTimeToSeconds(timeInput.value.trim());
  socket.emit("adminPlayLink", { url: input.value.trim(), startSeconds: startSeconds });
  input.value = "";
  timeInput.value = "";
});

// Accepts "1:12" (mm:ss) or plain "72" (seconds), returns seconds
function parseTimeToSeconds(text) {
  if (!text) return 0;
  if (text.indexOf(":") !== -1) {
    var parts = text.split(":");
    var mins = parseInt(parts[0], 10) || 0;
    var secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(text, 10) || 0;
}

// --- Requests (admin side) ---
function renderRequests(requests) {
  var list = document.getElementById("requestList");
  list.innerHTML = "";
  requests.slice().reverse().forEach(addRequestToList);
  document.getElementById("requestCount").textContent =
    requests.length ? "(" + requests.length + ")" : "";
}

function addRequestToList(entry) {
  var list = document.getElementById("requestList");
  var item = document.createElement("div");
  item.className = "request-item";
  item.innerHTML = "🎶 " + escapeHtml(entry.text) + '<span class="req-time">' + entry.time + "</span>";
  list.insertBefore(item, list.firstChild);
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

socket.on("newRequest", function (entry) {
  addRequestToList(entry);
});

// --- Requests (everyone's send box) ---
document.getElementById("requestSendBtn").addEventListener("click", sendRequest);
document.getElementById("requestInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") sendRequest();
});

function sendRequest() {
  var input = document.getElementById("requestInput");
  if (!input.value.trim()) return;
  socket.emit("songRequest", input.value.trim());
  input.value = "";
}