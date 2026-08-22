// app.js
const BACKEND_URL = "https://tempo-wala.onrender.com";

const BACKGROUND_VIDEOS = [
  "bg1.mp4", "bg2.mp4", "bg3.mp4", "bg4.mp4", "bg5.mp4", "bg6.mp4", "bg7.mp4"
];
var availableBackgrounds = [...BACKGROUND_VIDEOS];
var currentPlayingVideoId = null;

function changeBackgroundRandomly() {
  if (availableBackgrounds.length === 0) {
    availableBackgrounds = [...BACKGROUND_VIDEOS];
  }
  var randomIndex = Math.floor(Math.random() * availableBackgrounds.length);
  var nextBg = availableBackgrounds.splice(randomIndex, 1)[0];
  
  var videoEl = document.querySelector(".bg-video");
  if (videoEl) {
    videoEl.src = nextBg;
    var playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(function(e) { console.log("Video autoplay blocked:", e); });
    }
  }
}

var socket = io(BACKEND_URL);
var player = null;
var pendingSync = null;
var isAdmin = false;
var activePlaylistKey = null;
var trackDuration = 0;
var trackElapsedAtSync = 0;
var syncReceivedAt = Date.now();

// --- Network Latency Optimization ---
var networkLatency = 0;
function measureLatency() {
  socket.emit("pingTime", Date.now());
}
socket.on("pongTime", function(data) {
  var now = Date.now();
  networkLatency = (now - data.clientTime) / 2;
  // Schedule next ping in 30s
  setTimeout(measureLatency, 30000);
});
// Start measuring on connect
socket.on("connect", function() {
  measureLatency();
});

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

// --- Room Logic ---
var currentRoomCode = "main";

document.getElementById("createRoomBtn").addEventListener("click", function() {
  socket.emit("createRoom");
});
document.getElementById("joinRoomBtn").addEventListener("click", function() {
  var code = document.getElementById("joinRoomInput").value.trim();
  if (code) {
    socket.emit("joinRoom", code);
  }
});
document.getElementById("leaveRoomBtn").addEventListener("click", function() {
  socket.emit("leaveRoom");
});

document.getElementById("copyRoomBtn").addEventListener("click", function() {
  var btn = this;
  if (navigator.clipboard && currentRoomCode && currentRoomCode !== "main") {
    navigator.clipboard.writeText(currentRoomCode).then(function() {
      var originalText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function() { btn.textContent = originalText; }, 2000);
    });
  }
});

socket.on("roomCreated", function(code) {
  currentRoomCode = code;
  showRoomJoinedUI(code);
});

socket.on("roomJoined", function(code) {
  currentRoomCode = code;
  if (code === "main") {
    showRoomNotJoinedUI();
  } else {
    showRoomJoinedUI(code);
  }
  document.getElementById("roomErrorMsg").hidden = true;
});

socket.on("roomError", function(msg) {
  var err = document.getElementById("roomErrorMsg");
  err.textContent = msg;
  err.hidden = false;
});

socket.on("roomDestroyed", function(msg) {
  alert(msg);
  socket.emit("leaveRoom");
});

function showRoomJoinedUI(code) {
  document.getElementById("roomNotJoined").hidden = true;
  document.getElementById("roomJoined").hidden = false;
  document.getElementById("currentRoomCodeLabel").textContent = code;
}

function showRoomNotJoinedUI() {
  document.getElementById("roomNotJoined").hidden = false;
  document.getElementById("roomJoined").hidden = true;
}

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
  // Apply latency compensation to elapsed time
  data.elapsed += (networkLatency / 1000);
  
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

// Continuous drift-correction
socket.on("resync", function (data) {
  if (!player || typeof player.getCurrentTime !== "function") return;
  try {
    var current = player.getVideoData();
    if (!current || current.video_id !== data.videoId) return; // different song, ignore
    
    // Apply latency compensation
    var adjustedElapsed = data.elapsed + (networkLatency / 1000);
    
    trackElapsedAtSync = adjustedElapsed;
    syncReceivedAt = Date.now();
    var myTime = player.getCurrentTime();
    var drift = Math.abs(myTime - adjustedElapsed);
    // tighter drift threshold for better sync (0.3s instead of 0.6s)
    if (drift > 0.3) {
      player.seekTo(adjustedElapsed, true);
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

  if (data.videoId && data.videoId !== currentPlayingVideoId) {
    currentPlayingVideoId = data.videoId;
    changeBackgroundRandomly();
  }

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

  if (typeof data.roomListeners !== 'undefined') {
    var ruCount = document.getElementById("roomUserCount");
    if (ruCount) ruCount.textContent = data.roomListeners;
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
    height: "250",
    width: "250",
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
  document.getElementById("entryControls").classList.add("hidden");
  document.getElementById("entryCenterStack").classList.add("radio-active");
  document.getElementById("dock").hidden = false;
  var seoSection = document.getElementById("seoSection");
  if (seoSection) {
    seoSection.classList.add("hidden");
  }
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
  document.getElementById("searchWidget").hidden = false;
  document.getElementById("progressTrack").classList.add("admin-mode");
  activePlaylistKey = res.currentPlaylistKey;
  renderPlaylistButtons(res.playlists);
  renderRequests(res.requests);
  updateSearchCountLabel(res.searchCount);
});

socket.on("adminDemoted", function () {
  isAdmin = false;
  document.getElementById("adminPanel").hidden = true;
  document.getElementById("adminTransport").hidden = true;
  document.getElementById("searchWidget").hidden = true;
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

var searchDebounceTimer = null;
document.getElementById("searchInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") runSearch();
});
document.getElementById("searchInput").addEventListener("input", function () {
  clearTimeout(searchDebounceTimer);
  var value = this.value.trim();
  if (value.length < 2) return; // wait for at least 2 characters
  searchDebounceTimer = setTimeout(runSearch, 500); // waits 0.5s after you stop typing
});

function runSearch() {
  var input = document.getElementById("searchInput");
  if (!input.value.trim()) return;
  socket.emit("adminSearch", input.value.trim());
}

socket.on("searchResults", function (data) {
  var container = document.getElementById("searchResults");
  container.innerHTML = "";
  data.results.forEach(function (r) {
    var item = document.createElement("div");
    item.className = "search-result-item";
    item.innerHTML = '<img src="' + r.thumbnail + '"><span>' + escapeHtml(r.title) + "</span>";
    item.addEventListener("click", function () {
      socket.emit("adminPlaySearchResult", r.videoId);
      container.innerHTML = "";
      document.getElementById("searchInput").value = "";
    });
    container.appendChild(item);
  });
  updateSearchCountLabel(data.searchCount);
});

function updateSearchCountLabel(count) {
  var label = document.getElementById("searchCountLabel");
  if (label && typeof count === "number") {
    label.textContent = "(" + count + " searches today)";
  }
}

document.getElementById("linkPlayBtn").addEventListener("click", function () {
  var input = document.getElementById("linkInput");
  var timeInput = document.getElementById("startTimeInput");
  if (!input.value.trim()) return;
  var startText = timeInput ? timeInput.value.trim() : "";
  var startSeconds = parseTimeToSeconds(startText);
  socket.emit("adminPlayLink", { url: input.value.trim(), startSeconds: startSeconds });
  input.value = "";
  if (timeInput) timeInput.value = "";
});

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