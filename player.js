(() => {
  const tracks = Array.from(document.querySelectorAll("a.track"));
  const byId = (id) => document.getElementById(id);
  const frame = byId("recording");
  const play = byId("play");
  const seek = byId("seek");
  const copy = byId("copy");
  const previous = byId("previous");
  const next = byId("next");
  let index = tracks.findIndex((track) => track.hasAttribute("aria-current"));
  let player;
  let ready = false;
  let timer;
  let playOnArrival = false;
  try {
    const expected = sessionStorage.getItem("h100s-play-on-arrival");
    sessionStorage.removeItem("h100s-play-on-arrival");
    playOnArrival = expected === location.href;
  } catch {
    // The embedded player also has its own Play button when storage is disabled.
  }

  const label = (track) => track.querySelector(".name").textContent;
  const time = (n) => Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");
  const move = (offset) => (index + offset + tracks.length) % tracks.length;

  function renderSelection() {
    const track = tracks[index];
    const title = label(track);
    for (const item of tracks) item.removeAttribute("aria-current");
    track.setAttribute("aria-current", "true");
    byId("number").textContent = track.querySelector(".index").textContent;
    byId("track-title").textContent = title;
    frame.title = "Play " + title + " by Charles Lee";
    byId("watch").href = "https://www.youtube.com/watch?v=" + track.dataset.video;
    previous.href = tracks[move(-1)].href;
    next.href = tracks[move(1)].href;
    document.title = title + " · H100s & Burn Rate";
    byId("notice").textContent = "";
    byId("copy-url").hidden = true;
    seek.max = track.dataset.seconds;
    updateTime(0, Number(track.dataset.seconds));
    setPlaying(false);
  }

  function updateTime(seconds, duration) {
    const at = Math.max(0, Math.min(seconds, duration));
    seek.value = String(Math.floor(at));
    seek.setAttribute("aria-valuetext", time(at) + " of " + time(duration));
    byId("elapsed").textContent = time(at);
    byId("duration").textContent = time(duration);
  }

  function setPlaying(playing) {
    play.textContent = playing ? "Pause" : "Play";
    play.setAttribute("aria-label", (playing ? "Pause " : "Play ") + label(tracks[index]));
  }

  function tick() {
    const duration = player.getDuration() || Number(tracks[index].dataset.seconds);
    seek.max = String(Math.floor(duration));
    updateTime(player.getCurrentTime() || 0, duration);
  }

  function select(i, autoplay, addHistory) {
    if (addHistory && location.href !== tracks[i].href) history.pushState(null, "", tracks[i].href);
    index = i;
    renderSelection();
    if (autoplay) player.loadVideoById(tracks[i].dataset.video);
    else player.cueVideoById(tracks[i].dataset.video);
  }

  function navigate(event, i, focusTitle) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!ready) {
      try { sessionStorage.setItem("h100s-play-on-arrival", tracks[i].href); } catch {}
      return;
    }
    event.preventDefault();
    select(i, true, true);
    if (focusTitle) byId("track-title").focus();
  }

  tracks.forEach((track, i) => track.addEventListener("click", (event) => navigate(event, i, true)));
  previous.addEventListener("click", (event) => navigate(event, move(-1), false));
  next.addEventListener("click", (event) => navigate(event, move(1), false));
  window.addEventListener("popstate", () => {
    const i = tracks.findIndex((track) => new URL(track.href).pathname === location.pathname);
    const target = Math.max(0, i);
    if (target === index) return;
    if (ready) select(target, false, false);
    else location.reload();
  });

  copy.hidden = false;
  copy.addEventListener("click", async () => {
    const url = tracks[index].href;
    try {
      await navigator.clipboard.writeText(url);
      byId("notice").textContent = "Track link copied.";
    } catch {
      const field = byId("copy-url");
      field.value = url;
      field.hidden = false;
      field.focus();
      field.select();
      byId("notice").textContent = "Copy the selected track link.";
    }
  });

  play.addEventListener("click", () => {
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) player.pauseVideo();
    else player.playVideo();
  });
  seek.addEventListener("input", () => {
    player.seekTo(Number(seek.value), true);
    updateTime(Number(seek.value), Number(seek.max));
  });

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(frame, {
      events: {
        onReady() {
          ready = true;
          play.hidden = false;
          byId("seek-controls").hidden = false;
          setPlaying(player.getPlayerState() === YT.PlayerState.PLAYING);
          tick();
          if (playOnArrival) player.playVideo();
        },
        onAutoplayBlocked() {
          setPlaying(false);
          byId("notice").textContent = "Press Play to start this recording.";
        },
        onStateChange({ data }) {
          clearInterval(timer);
          setPlaying(data === YT.PlayerState.PLAYING || data === YT.PlayerState.BUFFERING);
          if (data === YT.PlayerState.PLAYING) {
            byId("notice").textContent = "";
            tick();
            timer = setInterval(tick, 500);
          }
          if (data === YT.PlayerState.PAUSED) tick();
          if (data === YT.PlayerState.ENDED && index < tracks.length - 1) {
            select(index + 1, true, true);
          }
        },
        onError() {
          clearInterval(timer);
          setPlaying(false);
          byId("notice").textContent = "This recording couldn’t play here. Open it on YouTube to listen.";
        },
      },
    });
  };
  const api = document.createElement("script");
  api.src = "https://www.youtube.com/iframe_api";
  document.head.append(api);
})();
