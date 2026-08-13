// app.js
const BACKEND_URL = "https://tempo-wala.onrender.com";

var socket = io(BACKEND_URL);
var player = null;
var pendingSync = null;
var isAdmin = false;
var activePlaylistKey = null;

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
  if (!input.value.trim()) return;
  socket.emit("adminPlayLink", input.value.trim());
  input.value = "";
});

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