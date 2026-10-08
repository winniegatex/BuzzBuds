/* BuzzBuds motion helpers — transforms/opacity only, lazy FX layer */
const BuzzMotion = (() => {
  let fxRoot = null;
  let typingTimer = null;

  function fx() {
    if (!fxRoot) fxRoot = document.getElementById("fx-layer");
    return fxRoot;
  }

  function active() {
    if (typeof motionEnabled === "function" && !motionEnabled()) return false;
    if (typeof animationsEnabled === "function" && !animationsEnabled()) return false;
    return true;
  }

  function spawn(node, ms = 900) {
    const layer = fx();
    if (!layer || !node) return;
    layer.appendChild(node);
    window.setTimeout(() => node.remove(), ms);
  }

  function floatEmoji(emoji, big = false) {
    if (!active()) return;
    const el = document.createElement("span");
    el.className = `fx-emoji${big ? " big" : ""}`;
    el.textContent = emoji;
    el.style.left = `${40 + Math.random() * 20}%`;
    spawn(el, big ? 1400 : 1000);
  }

  function heartBurst(count = 10) {
    if (!active()) return;
    const hearts = ["♥", "💕", "💗", "✨"];
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => {
        const el = document.createElement("span");
        el.className = "fx-heart";
        el.textContent = hearts[i % hearts.length];
        el.style.left = `${15 + Math.random() * 70}%`;
        el.style.animationDuration = `${0.9 + Math.random() * 0.5}s`;
        spawn(el, 1600);
      }, i * 45);
    }
  }

  function confetti(n = 36) {
    if (!active()) return;
    const colors = ["#ff6b8a", "#ff9a7a", "#ffd166", "#c77dff", "#7ee0d3"];
    for (let i = 0; i < n; i++) {
      const bit = document.createElement("span");
      bit.className = "fx-confetti";
      bit.style.background = colors[i % colors.length];
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.animationDelay = `${Math.random() * 0.15}s`;
      bit.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
      spawn(bit, 1800);
    }
  }

  function partnerPulse(name) {
    if (!active()) return;
    document.body.classList.add("partner-pulse-glow");
    window.setTimeout(() => document.body.classList.remove("partner-pulse-glow"), 2200);
    heartBurst(8);
    const toast = document.getElementById("toast");
    const text = document.getElementById("toast-text");
    const actions = document.getElementById("toast-actions");
    if (toast && text && actions) {
      text.textContent = `${name || "Your person"} is thinking of you ♥`;
      actions.innerHTML = "";
      toast.hidden = false;
      window.setTimeout(() => {
        if (text.textContent.includes("thinking of you")) toast.hidden = true;
      }, 4200);
    }
  }

  function partnerOnlineGlow() {
    if (!active()) return;
    document.body.classList.add("partner-online-glow");
    window.setTimeout(() => document.body.classList.remove("partner-online-glow"), 2400);
  }

  function mascotLayer() {
    let layer = document.getElementById("mascot-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "mascot-layer";
      layer.className = "mascot-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  }

  function playMascot(mood, ms = 1400) {
    if (!active()) return;
    const layer = mascotLayer();
    layer.innerHTML = `<span class="mascot mascot-${mood} mascot-pop">${typeof BuzzLogo !== "undefined" ? BuzzLogo.html("icon") : ""}</span>`;
    layer.hidden = false;
    window.setTimeout(() => {
      layer.innerHTML = "";
    }, ms);
  }

  function mascotWink() {
    playMascot("wink", 1100);
  }

  function mascotHearts() {
    playMascot("hearts", 1400);
    heartBurst(8);
  }

  function mascotWave() {
    playMascot("wave", 1400);
  }

  function sendPulse(btn) {
    if (!btn) return;
    btn.classList.remove("send-pulse");
    void btn.offsetWidth;
    btn.classList.add("send-pulse");
  }

  function reactBurst(emoji) {
    const big = /[♥❤💕💗😍🥰😘💋]/u.test(emoji || "");
    floatEmoji(emoji || "✨", big);
    if (big) heartBurst(6);
  }

  function skeletonBlock(lines = 3) {
    return `<div class="skeleton-stack" aria-hidden="true">${Array.from({ length: lines }, () => '<div class="skeleton-line"></div>').join("")}</div>`;
  }

  function scheduleTypingPing(fn) {
    if (typingTimer) window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(fn, 280);
  }

  return {
    active,
    floatEmoji,
    heartBurst,
    confetti,
    partnerPulse,
    partnerOnlineGlow,
    sendPulse,
    mascotWink,
    mascotHearts,
    mascotWave,
    reactBurst,
    skeletonBlock,
    scheduleTypingPing,
  };
})();
