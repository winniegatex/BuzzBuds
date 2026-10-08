const NOTE_COLORS = {
  cream: "#fff1df",
  blush: "#ffd5cc",
  butter: "#ffe6a6",
  mint: "#d7f3e4",
  lilac: "#eadfff",
  sky: "#d9ecff",
};

const S = {
  user: null,
  bubble: null,
  bubbleId: Number(sessionStorage.getItem("buzz-bubble") || 0),
  bubbles: [],
  incomingBubbleId: null,
  callBubbleId: null,
  preview: null,
  route: "landing",
  renderedRoute: null,
  authMode: "register",
  error: "",
  flash: "",
  bootError: "",
  chat: [],
  notes: [],
  notesSig: "",
  moments: [],
  momentsSig: "",
  momentOpen: 0,
  momentComments: {},
  game: null,
  gameType: null,
  selected: null,
  solSel: null,
  watch: null,
  watchComments: [],
  watchCommentsVideo: "",
  watchCommentsSig: "",
  gameComments: [],
  gameCommentsType: "",
  gameCommentsSig: "",
  turnHadMine: undefined,
  badges: { bubbles: 0, chat: 0, notes: 0, moments: 0, watch: 0, games: 0 },
  badgePrev: {},
  presence: { partnerOnline: false, partnerTyping: false },
  partnerOnlineWas: false,
  momentsReactSig: "",
  gameWinnerWas: null,
  activity: null,
  activityKey: null,
  activityComments: {},
  activityCommentsSig: {},
  timelineFeed: null,
  drawColor: "#F55F73",
  drawStrokes: [],
  searchResults: [],
  scrapSticker: "📎",
  jarSticker: "💌",
  player: null,
  watchLoadPending: null,
  applyingWatch: false,
  clockOffset: 0,
  lastSignalId: 0,
  signalsReady: false,
  incomingOffer: null,
  earlyIce: [],
  noteColor: "blush",
  callStatus: "",
  micOff: false,
  camOff: false,
  askLeave: false,
  navLock: false,
  ticking: false,
  beat: 0,
  backTo: null,
  gamesLobby: [],
  gamesTurnSig: "",
  uiGameMenu: false,
  watchChatOpen: true,
  gameChatOpen: false,
  sidebarCollapsed: localStorage.getItem("buzz-nav-collapsed") === "1",
  visitPop: false,
  hubActivity: null,
  todayDaily: null,
  todayMood: null,
  hashNav: false,
  resetStep: "",
  resetEmail: "",
  resetMask: "",
  resetToken: "",
  resetExpiresAt: 0,
  resetCooldownUntil: 0,
  resetTick: 0,
};

const GAME_TYPES = new Set(["tictactoe", "checkers", "solitaire", "kahoot", "connect4", "memory", "hangman"]);

const Call = { pc: null, local: null, remote: null, active: false, making: false };
let signalChain = Promise.resolve();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function escBr(value) {
  return esc(value).replace(/\n/g, "<br>");
}

function linkify(value) {
  return esc(value).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

const MOMENT_REACTS = ["❤️", "😍", "🔥", "😂", "👏", "🥰", "✨", "😮"];

const CHAT_EMOJIS = [
  "😀", "😂", "🥰", "😍", "😘", "😊", "🙂", "😭", "😮", "🤔", "😴", "🤗",
  "👍", "👏", "🙌", "🫶", "💪", "✌️", "🤞", "👀", "🙈", "💋",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💕", "💖", "💘", "💝",
  "🌹", "🌸", "✨", "⭐️", "🔥", "🎉", "🎬", "🍿", "☕", "🌙", "🌈", "💬",
];

function isEmojiHeavy(text) {
  const stripped = String(text || "").replace(/\s/g, "");
  if (!stripped || stripped.length > 16) return false;
  return !/[a-zA-Z0-9]/.test(stripped);
}

function formatChatBody(text) {
  const cls = isEmojiHeavy(text) ? "msg-emoji" : "";
  return cls ? `<p class="${cls}">${linkify(text)}</p>` : `<p>${linkify(text)}</p>`;
}

function emojiBarHtml(formKey) {
  const buttons = CHAT_EMOJIS.map((emoji) => `<button type="button" class="emoji-pick" data-act="emoji-pick" data-for="${formKey}" data-emoji="${emoji}" aria-label="${emoji}">${emoji}</button>`).join("");
  return `<div class="emoji-bar" data-emoji-for="${formKey}" hidden>${buttons}</div>`;
}

function chatComposerHtml(formKey, { max, placeholder, disabled = false, extraClass = "" } = {}) {
  const off = disabled ? "disabled" : "";
  const hide = disabled ? "hidden" : "";
  return `<form data-form="${formKey}" class="composer chat-compose ${extraClass}" ${hide}>
    <div class="composer-row">
      <button type="button" class="btn soft emoji-btn" data-act="emoji-toggle" data-for="${formKey}" aria-label="Add emoji" ${off}>😊</button>
      <textarea name="body" rows="1" maxlength="${max}" placeholder="${esc(placeholder)}" autocomplete="off" ${off}></textarea>
      <button class="btn rose" type="submit" ${off}>Send</button>
    </div>
    ${emojiBarHtml(formKey)}
  </form>`;
}

function scrollChatToEnd() {
  const list = document.getElementById("msgs");
  if (list) list.scrollTop = list.scrollHeight;
  const watchList = document.getElementById("watch-msgs");
  if (watchList) watchList.scrollTop = watchList.scrollHeight;
  const gameList = document.getElementById("game-msgs");
  if (gameList) gameList.scrollTop = gameList.scrollHeight;
  const actList = document.getElementById("activity-msgs");
  if (actList) actList.scrollTop = actList.scrollHeight;
}

function syncViewportHeight() {
  const vv = window.visualViewport;
  const height = vv ? Math.round(vv.height) : window.innerHeight;
  const offset = vv ? Math.round(vv.offsetTop) : 0;
  const root = document.documentElement;
  root.style.setProperty("--app-h", `${height}px`);
  root.style.setProperty("--vv-top", `${offset}px`);
  const kb = vv ? (window.innerHeight - vv.height > 80) : false;
  document.body.classList.toggle("kb-open", kb);
  if (kb) scrollChatToEnd();
}

function growComposer(el) {
  if (!(el instanceof HTMLTextAreaElement) || !el.closest(".composer")) return;
  el.style.height = "auto";
  const max = 16 * 4 * 1.4;
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}

function insertAtCursor(input, text) {
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const next = input.value.slice(0, start) + text + input.value.slice(end);
  const max = Number(input.maxLength);
  if (max > 0 && next.length > max) return;
  input.value = next;
  const pos = start + text.length;
  input.setSelectionRange(pos, pos);
  input.focus();
}

function closeEmojiBars(except) {
  document.querySelectorAll(".emoji-bar").forEach((bar) => {
    if (!except || bar.dataset.emojiFor !== except) bar.hidden = true;
  });
}

let turnAudio = null;

function playTurnRing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!turnAudio) turnAudio = new Ctx();
    if (turnAudio.state === "suspended") turnAudio.resume();
    const ctx = turnAudio;
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    gain.connect(ctx.destination);
    const tones = [
      [740, 0],
      [988, 0.16],
      [1175, 0.32],
    ];
    tones.forEach(([freq, start]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      noteGain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + start + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.28);
      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.3);
    });
  } catch {
    /* audio blocked */
  }
}

function gameYourTurn(game) {
  if (!game) return false;
  if (game.type === "tictactoe" || game.type === "checkers" || game.type === "connect4" || game.type === "memory" || game.type === "hangman") {
    return !!game.yourTurn && !game.winner;
  }
  if (game.type === "kahoot") return !!game.yourTurn;
  return false;
}

function gameStateSig(game) {
  if (!game) return "";
  if (game.type === "kahoot") return `${game.version}:${game.phase}:${game.current}:${game.answered}:${game.reveal ? 1 : 0}`;
  return `${game.type}:${game.version}:${game.winner || ""}:${game.yourTurn ? 1 : 0}`;
}

function gameTypeLabel(type) {
  const map = {
    tictactoe: "Tic-tac-toe", checkers: "Checkers", solitaire: "Solitaire", kahoot: "Kahoot",
    connect4: "Connect Four", memory: "Memory Match", hangman: "Hangman",
  };
  return map[type] || "your game";
}

function clientGameInProgress(game) {
  if (!game || game.winner) return false;
  if (game.type === "solitaire") return (game.you?.moves || 0) > 0;
  if (game.type === "kahoot") return game.phase && game.phase !== "build" && game.phase !== "done";
  if (game.type === "hangman") return game.phase === "guess" || !!game.mask;
  if (game.type === "tictactoe") return game.board?.some((c) => c !== null);
  if (game.type === "connect4") return game.board?.some((row) => row.some((c) => c !== null));
  if (game.type === "memory") return game.cards?.some((c) => c.matched || c.up);
  if (game.type === "checkers") return !!game.lastMove;
  return false;
}

function gameActionsFooter(game) {
  if (game.winner) {
    return `<div class="row gap-top game-actions">
      <button class="btn rose" type="button" data-act="reset-game">Play again</button>
      <button class="btn soft" type="button" data-act="go" data-route="games" data-lobby="1">Back to games</button>
      <button class="btn ghost" type="button" data-act="go" data-route="home">Home</button>
    </div>`;
  }
  return `<div class="row gap-top game-actions">
    <button class="btn ghost" type="button" data-act="game-menu">Leave game</button>
  </div>`;
}

function wrapGameBody(html, game) {
  return `${html}${gameActionsFooter(game)}`;
}

function gameBarHtml(title) {
  return `<header class="activity-bar glass">
    <button class="bar-btn" type="button" data-act="nav-back" aria-label="Back to games">←</button>
    <div class="activity-bar-title"><span class="eyebrow">Games</span><strong>${esc(title)}</strong></div>
    <button class="bar-btn" type="button" data-act="go" data-route="home" aria-label="Home">⌂</button>
    <button class="bar-btn game-chat-toggle" type="button" data-act="game-chat-toggle" aria-label="Game chat">💬</button>
    <button class="bar-btn" type="button" data-act="game-menu" aria-label="Game menu">⋯</button>
  </header>`;
}

function gameLeaveOverlayHtml() {
  if (!S.uiGameMenu) return "";
  const canResign = S.game && !["solitaire"].includes(S.game.type) && clientGameInProgress(S.game);
  return `<div class="game-leave-overlay" role="dialog" aria-modal="true">
    <div class="game-leave-card glass">
      <h3>Pause this game and come back later?</h3>
      <p class="empty">Your board stays saved for both of you.</p>
      <div class="stack">
        <button class="btn rose" type="button" data-act="game-leave-pause">Pause &amp; leave</button>
        ${canResign ? `<button class="btn soft" type="button" data-act="game-leave-resign">Resign</button>` : ""}
        <button class="btn ghost" type="button" data-act="game-leave-stay">Stay</button>
      </div>
    </div>
  </div>`;
}

function lobbyStatusPill(type) {
  const row = (S.gamesLobby || []).find((g) => g.type === type);
  if (!row?.status) return "";
  const cls = row.yourTurn ? "pill turn" : "pill";
  return `<span class="${cls}">${esc(row.status)}</span>`;
}

function gameLobbyCard(type, title, desc) {
  return `<button class="game-card" type="button" data-act="play" data-type="${type}"><h3>${esc(title)} ${lobbyStatusPill(type)}</h3><p>${esc(desc)}</p></button>`;
}

async function leaveGameLobby() {
  S.uiGameMenu = false;
  S.backTo = { route: "home" };
  await go("games", { lobby: true, force: true, skipBack: true });
}

async function tryLeaveGame() {
  if (S.game && clientGameInProgress(S.game) && !S.game.winner) {
    S.uiGameMenu = true;
    render();
    return;
  }
  await leaveGameLobby();
}

async function resignCurrentGame() {
  if (!S.game || !S.gameType) return;
  if (!["solitaire"].includes(S.game.type) && clientGameInProgress(S.game)) {
    const data = await api("game_move", {
      method: "POST",
      json: { type: S.game.type, version: S.game.version, action: "resign" },
    });
    S.game = data.game;
  }
  await leaveGameLobby();
}

function checkTurnNotify(game) {
  if (!game) return;
  const mine = gameYourTurn(game);
  if (S.turnHadMine === undefined) {
    S.turnHadMine = mine;
    S.gameWinnerWas = game.winner || null;
    return;
  }
  if (mine && !S.turnHadMine) {
    if (!hubNotifyMuted("games")) playTurnRing();
    if (S.route !== "games" || S.gameType !== game.type) {
      showFlash(`Your turn in ${gameTypeLabel(game.type)}.`);
    }
  }
  if (game.winner && game.winner !== S.gameWinnerWas && game.type !== "solitaire" && typeof BuzzMotion !== "undefined") {
    BuzzMotion.confetti();
  }
  S.gameWinnerWas = game.winner || null;
  S.turnHadMine = mine;
}

function momentReactSig(moments) {
  return (moments || []).map((m) => `${m.id}:${JSON.stringify(m.reactionCounts || {})}`).join("|");
}

async function pullPresence() {
  if (!S.bubble || S.bubble.status !== "active") return;
  try {
    const data = await api("presence");
    const was = S.partnerOnlineWas;
    S.presence = { partnerOnline: !!data.partnerOnline, partnerTyping: !!data.partnerTyping };
    if (data.partnerOnline && !was && typeof BuzzMotion !== "undefined") BuzzMotion.partnerOnlineGlow();
    S.partnerOnlineWas = !!data.partnerOnline;
    paintPartnerStatus();
    const chip = document.querySelector(".you-chip");
    if (chip) chip.classList.toggle("partner-here", !!data.partnerOnline);
  } catch {
    /* ignore */
  }
}

function pingTyping() {
  if (!S.bubble || S.bubble.status !== "active") return;
  if (typeof BuzzMotion !== "undefined") {
    BuzzMotion.scheduleTypingPing(() => {
      api("presence", { method: "POST", json: { typing: true } }).catch(() => {});
    });
  }
}

function gameCommentsHtml() {
  if (!S.gameComments.length) {
    return `<div class="empty empty-illo">${mascotHtml("wait")}<p>No messages yet. Say hi — they'll see it here.</p></div>`;
  }
  return S.gameComments.map((comment) => {
    const mine = comment.senderId === S.user.id;
    return `<div class="watch-msg ${mine ? "mine" : "theirs"}"><strong>${esc(whoName(comment.senderId))}</strong>${formatChatBody(comment.body)}<time>${esc(clock(comment.createdAt))}</time></div>`;
  }).join("");
}

function gameChatAside() {
  return `<aside class="game-chat card">
    <h3>Game chat</h3>
    <p class="empty">Banter for this match only.</p>
    <div id="game-msgs" class="watch-msgs">${gameCommentsHtml()}</div>
    ${chatComposerHtml("game-chat", { max: 280, placeholder: "Cheer, tease, or gloat…", extraClass: "watch-composer" })}
  </aside>`;
}

function partnerName() {
  return S.bubble?.partner?.displayName || "your person";
}

function initial(name) {
  return esc(String(name || "?").trim().charAt(0).toUpperCase() || "?");
}

function ava(name, cls = "") {
  return `<span class="ava ${cls}">${initial(name)}</span>`;
}

function whoName(id) {
  if (S.user && id === S.user.id) return "You";
  return partnerName();
}

function togetherLabel(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Day one together";
  if (days === 1) return "1 day together";
  return `${days} days together`;
}

function daysTogetherLabel(bubble) {
  const days = bubble?.daysTogether;
  if (typeof days === "number") {
    if (days <= 0) return "Day one together";
    if (days === 1) return "1 day together";
    return `${days} days together`;
  }
  return togetherLabel(bubble?.createdAt || new Date().toISOString());
}

function visitCountdownLabel(iso) {
  if (!iso) return "";
  const target = new Date(`${iso}T12:00:00`);
  const days = Math.ceil((target.getTime() - Date.now()) / 86400000);
  if (days < 0) return "Visit time — soak it in";
  if (days === 0) return "Together today";
  if (days === 1) return "1 day until you're together";
  return `${days} days until you're together`;
}

function visitCountdownLive(iso) {
  if (!iso) return "Set a date you'll see each other";
  const target = new Date(`${iso}T12:00:00`);
  const ms = target.getTime() - Date.now();
  if (ms < -86400000) return "Visit time — soak it in";
  if (ms < 0) return "Together today";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days <= 0 && hours <= 0) return `${mins}m until you're together`;
  if (days <= 0) return `${hours}h ${mins}m until you're together`;
  return `${days}d ${hours}h ${mins}m until you're together`;
}

function dayTogetherHeadline(bubble) {
  const days = typeof bubble?.daysTogether === "number"
    ? bubble.daysTogether
    : Math.max(0, Math.floor((Date.now() - new Date(bubble?.createdAt || Date.now()).getTime()) / 86400000));
  const n = days <= 0 ? 1 : days;
  return `Day ${n} together`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function hubCardPreviews() {
  const lastNote = S.notes?.[0];
  const lastMoment = S.moments?.[0];
  const lastChat = S.chat?.length ? S.chat[S.chat.length - 1] : null;
  const waiting = (S.gamesLobby || []).filter((g) => g.yourTurn);
  const snippet = S.bubble?.snippet;
  return {
    chat: lastChat ? `${whoName(lastChat.senderId)} · ${timeAgo(lastChat.createdAt)}` : (snippet ? String(snippet).slice(0, 48) : "Private messages just for two"),
    notes: lastNote ? `${whoName(lastNote.authorId)} sent a note ${timeAgo(lastNote.createdAt)}` : "Pin sweet notes on the board",
    moments: lastMoment ? `${whoName(lastMoment.authorId)} shared ${timeAgo(lastMoment.createdAt)}` : "Photos, reactions, and comments",
    games: waiting.length ? `Your turn in ${waiting.map((g) => gameTypeLabel(g.type)).join(", ")}` : "Boards, quizzes, and quick play",
    watch: S.watch?.videoId ? "A video is queued for you both" : "Synced video and show chat",
    calendar: S.bubble?.nextVisitAt ? visitCountdownLive(S.bubble.nextVisitAt) : "Dates, lists, and favorites",
    draw: "Draw, jar, scrapbook, and more",
    datenight: S.bubble?.nextVisitAt ? visitCountdownLive(S.bubble.nextVisitAt) : "Pick a night and lock it in",
  };
}

function partnerStatusHtml() {
  const online = S.presence?.partnerOnline;
  const typing = S.presence?.partnerTyping && S.route === "chat";
  let label = online ? "Here with you" : "Away for now";
  if (typing) label = "Typing something sweet…";
  return `<p id="partner-status" class="partner-status ${online ? "online" : ""} ${typing ? "typing" : ""}"><span class="status-dot" aria-hidden="true"></span>${esc(label)}</p>`;
}

function hubHeroHtml() {
  if (!S.bubble || S.bubble.status !== "active" || !S.user) return "";
  const me = S.user.displayName || "You";
  const them = partnerName();
  const visit = visitCountdownLive(S.bubble.nextVisitAt);
  const pop = S.visitPop ? "" : "hidden";
  return `<section class="hub-hero glass">
    <div class="hub-hero-bg" aria-hidden="true"></div>
    <div class="hub-hero-pair">
      <div class="hub-ava-wrap">${ava(me, "lg")}<span class="hub-ava-name">${esc(me.split(" ")[0] || "You")}</span></div>
      <div class="hub-hero-heart" aria-hidden="true"><span class="heart-line"></span><span class="heart-pulse">♥</span></div>
      <div class="hub-ava-wrap">${ava(them, "lg")}<span class="hub-ava-name">${esc(them.split(" ")[0] || "Them")}</span></div>
    </div>
    <p class="hub-hero-days">${esc(dayTogetherHeadline(S.bubble))}</p>
    <p class="hub-hero-visit" id="visit-countdown">${esc(visit)}</p>
    <div class="hub-hero-actions row">
      <button class="btn rose hub-cta" type="button" data-act="thinking">Thinking of you</button>
      <button class="btn soft hub-cta" type="button" data-act="go" data-route="call">Video call</button>
    </div>
    <div class="visit-wrap">
      <button class="btn ghost" type="button" data-act="visit-toggle">Set next visit</button>
      <div class="visit-pop glass" ${pop}>
        <form data-form="visit" class="visit-form stack">
          <label for="next-visit-date">Next visit</label>
          <input id="next-visit-date" type="date" name="nextVisit" value="${esc(S.bubble.nextVisitAt || "")}" aria-label="Next visit date">
          <button class="btn rose" type="submit">Save</button>
        </form>
      </div>
    </div>
  </section>`;
}

function todayRailInner() {
  const daily = S.todayDaily || {};
  const mood = S.todayMood || {};
  const events = (S.hubActivity?.calendar || []).slice(0, 4);
  const waiting = (S.gamesLobby || []).filter((g) => g.yourTurn);
  const feed = [];
  if (S.notes?.[0]) feed.push(`${whoName(S.notes[0].authorId)} left a note ${timeAgo(S.notes[0].createdAt)}`);
  if (S.moments?.[0]) feed.push(`${whoName(S.moments[0].authorId)} shared a moment ${timeAgo(S.moments[0].createdAt)}`);
  if (S.chat?.length) {
    const last = S.chat[S.chat.length - 1];
    feed.push(`${whoName(last.senderId)} in chat ${timeAgo(last.createdAt)}`);
  }
  waiting.forEach((g) => feed.push(`Your turn in ${gameTypeLabel(g.type)}`));
  const dailyBody = daily.question
    ? `<p class="rail-q">${esc(daily.question)}</p>
       ${daily.mine ? `<p class="empty">Answer saved.</p>` : `<button class="btn rose" type="button" data-act="go" data-route="daily" data-back-home="1">Answer</button>`}`
    : `<p class="empty">Today's question will land here.</p>
       <button class="btn ghost" type="button" data-act="go" data-route="daily" data-back-home="1">Open</button>`;
  const moodLine = `<p>You ${mood.mine ? esc(mood.mine) : "—"} · ${esc(partnerName())} ${mood.theirs ? esc(mood.theirs) : "—"}</p>
    <button class="btn ghost" type="button" data-act="go" data-route="mood" data-back-home="1">Check in</button>`;
  const dates = events.length
    ? events.map((e) => `<p>${esc(e.title || "Date")} · ${esc(e.at || e.date || "")}</p>`).join("")
    : `<p class="empty">No dates yet.</p>`;
  const feedHtml = feed.length ? feed.slice(0, 6).map((line) => `<p>${esc(line)}</p>`).join("") : `<p class="empty">Quiet for now.</p>`;
  return `<p class="eyebrow">Today</p>
    <article class="rail-card glass"><h3>Daily question</h3>${dailyBody}</article>
    <article class="rail-card glass"><h3>Moods</h3>${moodLine}</article>
    <article class="rail-card glass"><h3>Next visit</h3><p id="visit-countdown-rail">${esc(visitCountdownLive(S.bubble?.nextVisitAt))}</p>
      <button class="btn ghost" type="button" data-act="visit-toggle">Set date</button></article>
    <article class="rail-card glass"><h3>Upcoming</h3>${dates}
      <button class="btn ghost" type="button" data-act="go" data-route="calendar" data-back-home="1">Calendar</button></article>
    <article class="rail-card glass"><h3>Recent</h3>${feedHtml}</article>`;
}

function todayRailHtml() {
  if (!S.user || !S.bubble || S.bubble.status !== "active") return "";
  return `<aside class="rail" id="today-rail">${todayRailInner()}</aside>`;
}

async function hydrateTodayRail() {
  if (S.route !== "home" || !S.bubble || S.bubble.status !== "active") return;
  try {
    const [hub, daily, mood] = await Promise.all([
      api("activity", { query: { key: "hub" } }),
      api("activity", { query: { key: "daily" } }),
      api("activity", { query: { key: "mood" } }),
    ]);
    S.hubActivity = hub.activity || S.hubActivity;
    S.todayDaily = daily.activity || S.todayDaily;
    S.todayMood = mood.activity || S.todayMood;
    const rail = document.getElementById("today-rail");
    if (rail && S.route === "home") rail.innerHTML = todayRailInner();
  } catch {
    /* keep whatever is already painted */
  }
}

function paintPartnerStatus() {
  const el = document.getElementById("partner-status");
  if (!el) return;
  const online = S.presence?.partnerOnline;
  const typing = S.presence?.partnerTyping && S.route === "chat";
  let label = online ? "Here with you" : "Away for now";
  if (typing) label = "Typing something sweet…";
  el.className = `partner-status ${online ? "online" : ""} ${typing ? "typing" : ""}`;
  el.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${esc(label)}`;
}

function clock(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function mark(kind = "icon") {
  if (kind === "full") {
    return `<span class="brand-lockup full auth-logo-float"><img class="logo-full" src="assets/logo-mark.svg" alt="BuzzBuds" width="168" height="126"></span>`;
  }
  return `<span class="brand-lockup"><img class="mark" src="assets/icon.svg" alt="" width="36" height="36"><span class="wordmark">BuzzBuds</span></span>`;
}

function mascotHtml(mood = "idle") {
  return `<span class="mascot mascot-${mood}" aria-hidden="true"><img src="assets/logo-mark.svg" alt=""></span>`;
}

function icon(name) {
  const paths = {
    home: '<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M5 6h14v9H8l-3 3z"/>',
    note: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M9 12h6M9 16h4"/>',
    photo: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.4"/><path d="m4 16 4.5-4 3 3L15 11l5 5"/>',
    play: '<circle cx="12" cy="12" r="8"/><path d="m10 9 6 3-6 3z"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    video: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="m15 10 6-3v10l-6-3z"/>',
    user: '<circle cx="12" cy="9" r="3"/><path d="M6 19c1.5-3 3.5-4 6-4s4.5 1 6 4"/>',
    look: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    bubbles: '<circle cx="9" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function errorHtml() {
  if (!S.error) return `<p class="error" data-error hidden></p>`;
  return `<div class="error error-mascot" data-error>${mascotHtml("sleepy")}<p>${esc(S.error)}</p></div>`;
}

function flashHtml() {
  return `<p class="flash" data-flash ${S.flash ? "" : "hidden"}>${esc(S.flash)}</p>`;
}

function showError(message) {
  S.error = message || "";
  const el = document.querySelector("[data-error]");
  if (!el) {
    if (message) render();
    return;
  }
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `${mascotHtml("sleepy")}<p>${esc(message)}</p>`;
}

function showFlash(message) {
  S.flash = message || "";
  const el = document.querySelector("[data-flash]");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
  if (message && effectsOn()) {
    el.classList.remove("flash-pop");
    void el.offsetWidth;
    el.classList.add("flash-pop");
  }
}

function motionEnabled() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function syncMotionBody() {
  const brand = !S.user || S.route === "landing" || S.route === "auth";
  const inside = !!(S.user && S.bubble && S.bubble.status === "active");
  document.body.classList.toggle("brand-shell", brand);
  document.body.classList.toggle("auth-glow", brand && S.route === "auth");
  document.body.classList.toggle("in-bubble", inside);
  document.body.classList.toggle("fx-off", !animationsEnabled());
  document.body.classList.add("app-ready");
  if (inside && S.bubble?.ambienceHue != null) {
    document.body.style.setProperty("--ambience-hue", String(S.bubble.ambienceHue));
  } else {
    document.body.style.removeProperty("--ambience-hue");
  }
}

function runScreenEnter() {
  if (!effectsOn()) return;
  const screen = document.getElementById("screen");
  const landing = document.querySelector(".landing");
  const target = screen || landing;
  if (!target) return;
  target.classList.remove("screen-enter");
  void target.offsetWidth;
  target.classList.add("screen-enter");
}

function paintView(html) {
  const host = document.getElementById("view-root") || document.getElementById("app");
  const apply = () => {
    host.innerHTML = html;
    syncMotionBody();
    afterRender();
    runScreenEnter();
  };
  if (effectsOn() && typeof document.startViewTransition === "function") {
    document.startViewTransition(apply);
    return;
  }
  apply();
}

async function api(action, { method = "GET", json = null, body = null, query = null, bubbleId = null } = {}) {
  const params = new URLSearchParams({ action });
  if (query) {
    Object.entries(query).forEach(([key, value]) => params.set(key, value));
  }
  const opts = { method, headers: {}, credentials: "same-origin" };
  const chosenBubble = bubbleId || S.bubble?.id;
  if (chosenBubble) opts.headers["X-Bubble-Id"] = String(chosenBubble);
  if (method !== "GET") opts.headers["X-BuzzBuds"] = "1";
  if (json !== null) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(json);
  } else if (body) {
    opts.body = body;
  }
  let res;
  try {
    res = await fetch("api.php?" + params.toString(), opts);
  } catch {
    const err = new Error("Cannot reach BuzzBuds. Check that the site is running.");
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    if (res.status === 401 && !["login", "register", "state"].includes(action)) {
      S.user = null;
      S.bubble = null;
      S.bubbles = [];
      S.bubbleId = 0;
      S.stateReady = false;
      if (S.route !== "auth" && S.route !== "landing") {
        S.renderedRoute = null;
        queueMicrotask(() => go("auth", { force: true }));
      }
    }
    const err = new Error((data && data.error) || "Something went wrong.");
    err.status = res.status;
    throw err;
  }
  return data;
}

const PRESETS = {
  ember: {
    label: "Blush",
    light: { bg: "#FDE0E3", ink: "#4A1038", muted: "#9B0A6B", line: "#f7c8d2", accent: "#F55F73", deep: "#9B0A6B", card: "#fff6f7", wash: "#F97B6E" },
    dark: { bg: "#4A1038", ink: "#FDE0E3", muted: "#f3b8c8", line: "#6d2454", accent: "#F2709C", deep: "#F97B6E", card: "#5c1848", wash: "#9B0A6B" },
  },
  harbor: {
    label: "Harbor",
    light: { bg: "#e7f1f4", ink: "#10242c", muted: "#4d6872", line: "#d3e4ea", accent: "#1f7a8c", deep: "#145866", card: "#f7fbfc", wash: "#d4eef4" },
    dark: { bg: "#0e1c22", ink: "#eef7f8", muted: "#9db8c0", line: "#2a4450", accent: "#3ec1d3", deep: "#8ee4ef", card: "#17303a", wash: "#143038" },
  },
  moss: {
    label: "Moss",
    light: { bg: "#eef3e6", ink: "#1c2614", muted: "#5d6b52", line: "#dbe6d0", accent: "#4f7c3a", deep: "#345628", card: "#fbfdf7", wash: "#e0f0d0" },
    dark: { bg: "#141c12", ink: "#f4f8ef", muted: "#b7c6ac", line: "#31442a", accent: "#8fbf6a", deep: "#c6e6a8", card: "#243222", wash: "#1c2a18" },
  },
  dusk: {
    label: "Dusk",
    light: { bg: "#f3eaf6", ink: "#2a1830", muted: "#74607c", line: "#e6d7ee", accent: "#8b4d9b", deep: "#643672", card: "#fdf9ff", wash: "#f0dcf6" },
    dark: { bg: "#1c1224", ink: "#fbf6ff", muted: "#cbb6d4", line: "#453055", accent: "#d39adf", deep: "#f0d0f4", card: "#2e2238", wash: "#2a1836" },
  },
  ink: {
    label: "Ink",
    light: { bg: "#f6f4f1", ink: "#161513", muted: "#5e5a55", line: "#e4e0da", accent: "#c4552a", deep: "#8d3918", card: "#ffffff", wash: "#f0e4dc" },
    dark: { bg: "#111110", ink: "#f7f5f2", muted: "#b7b2ab", line: "#3a3834", accent: "#f0a07a", deep: "#ffd0b8", card: "#222220", wash: "#2a211c" },
  },
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function normalizeLook(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const pick = (key, allowed, fallback) => (allowed.includes(data[key]) ? data[key] : fallback);
  const hex = (key) => (/^#[0-9a-fA-F]{6}$/.test(data[key] || "") ? String(data[key]).toLowerCase() : "");
  return {
    preset: pick("preset", ["ember", "harbor", "moss", "dusk", "ink", "custom"], "ember"),
    mode: pick("mode", ["light", "dark"], "light"),
    accent: hex("accent"),
    bg: hex("bg"),
    density: pick("density", ["cozy", "compact"], "cozy"),
    nav: pick("nav", ["side", "top"], "side"),
    home: pick("home", ["grid", "stack"], "grid"),
    corners: pick("corners", ["round", "soft", "sharp"], "round"),
    span: pick("span", ["focus", "wide"], "focus"),
    notes: pick("notes", ["tilted", "flat"], "tilted"),
    animations: pick("animations", ["on", "off"], "on"),
  };
}

function animationsEnabled() {
  return currentLook().animations !== "off";
}

function effectsOn() {
  return motionEnabled() && animationsEnabled();
}

function currentLook() {
  return normalizeLook(S.user && S.user.appearance);
}

function tokensFor(look) {
  if (look.preset === "custom") {
    const bg = look.bg || (look.mode === "dark" ? "#1c1614" : "#f6f1ec");
    const dark = luminance(bg) < 0.45;
    const ink = dark ? "#f7f3ee" : "#1c1410";
    const accent = look.accent || "#F55F73";
    return {
      "--bg": bg,
      "--ink": ink,
      "--ink-on-dark": ink,
      "--muted": dark ? "#cbb8ae" : "#6d5c56",
      "--line": dark ? shade(bg, 32) : shade(bg, -18),
      "--rose": accent,
      "--rose-deep": shade(accent, dark ? 40 : -28),
      "--card": dark ? shade(bg, 20) : shade(bg, 16),
      "--wash": dark ? shade(bg, 12) : shade(accent, 150),
      "--shadow": dark ? "0 16px 40px rgba(0,0,0,0.35)" : "0 16px 40px rgba(44, 24, 16, 0.08)",
      dark,
    };
  }
  const preset = PRESETS[look.preset] || PRESETS.ember;
  const tone = preset[look.mode] || preset.light;
  const accent = look.accent || tone.accent;
  const deep = look.accent ? shade(accent, look.mode === "dark" ? 36 : -30) : tone.deep;
  return {
    "--bg": tone.bg,
    "--ink": tone.ink,
    "--ink-on-dark": tone.ink,
    "--muted": tone.muted,
    "--line": tone.line,
    "--rose": accent,
    "--rose-deep": deep,
    "--card": tone.card,
    "--wash": tone.wash,
    "--shadow": look.mode === "dark" ? "0 16px 40px rgba(0,0,0,0.35)" : "0 16px 40px rgba(44, 24, 16, 0.08)",
    dark: look.mode === "dark",
  };
}

function applyLook() {
  const root = document.documentElement;
  const props = ["--bg", "--ink", "--muted", "--line", "--rose", "--rose-deep", "--card", "--wash", "--bg-deep", "--ink-on-dark", "--shadow"];
  const brand = !S.user || S.route === "landing" || S.route === "auth";
  const theme = document.querySelector('meta[name="theme-color"]');
  if (brand) {
    props.forEach((key) => root.style.removeProperty(key));
    ["density", "nav", "home", "corners", "span", "notes"].forEach((key) => delete root.dataset[key]);
    document.body.className = "theme-dark";
    if (theme) theme.content = "#4A1038";
    return;
  }
  const look = currentLook();
  const tokens = tokensFor(look);
  props.forEach((key) => {
    if (key === "--bg-deep") return;
    root.style.setProperty(key, tokens[key]);
  });
  if (tokens.dark) root.style.setProperty("--bg-deep", tokens["--bg"]);
  else root.style.removeProperty("--bg-deep");
  root.dataset.density = look.density;
  root.dataset.nav = look.nav;
  root.dataset.home = look.home;
  root.dataset.corners = look.corners;
  root.dataset.span = look.span;
  root.dataset.notes = look.notes;
  document.body.className = tokens.dark ? "theme-dark" : "theme-light";
  if (theme) theme.content = tokens["--bg"];
}

function paintLook() {
  const look = currentLook();
  const tokens = tokensFor(look);
  document.querySelectorAll("[data-act='look']").forEach((btn) => {
    btn.classList.toggle("on", look[btn.dataset.key] === btn.dataset.value);
  });
  document.querySelectorAll("[data-look-color]").forEach((input) => {
    if (document.activeElement === input) return;
    if (input.dataset.lookColor === "accent") input.value = look.accent || tokens["--rose"];
    if (input.dataset.lookColor === "bg") input.value = look.bg || tokens["--bg"];
  });
}

let lookQueue = null;
let lookSaving = false;
let lookFlight = 0;

async function saveLook(patch) {
  lookQueue = normalizeLook({ ...(lookQueue || currentLook()), ...patch });
  S.user = { ...S.user, appearance: lookQueue };
  applyLook();
  paintLook();
  if (lookSaving) return;
  lookSaving = true;
  lookFlight++;
  try {
    while (lookQueue) {
      const next = lookQueue;
      lookQueue = null;
      const data = await api("profile", { method: "POST", json: { appearance: next } });
      if (!lookQueue) {
        S.user = data.user;
        applyLook();
        paintLook();
      }
    }
  } catch (err) {
    showError(err.message || "Could not save that look.");
  } finally {
    lookSaving = false;
    lookFlight--;
  }
}

function routeHash(route, gameType) {
  if (route === "games" && gameType) return `games/${gameType}`;
  return route;
}

function parseRouteHash(raw) {
  const h = String(raw || "").replace(/^#/, "").trim();
  const fallback = S.user ? "home" : "landing";
  const parts = (h || fallback).split("/").filter(Boolean);
  const base = parts[0] || fallback;
  if (base === "games" && parts[1] && GAME_TYPES.has(parts[1])) {
    return { route: "games", gameType: parts[1] };
  }
  return { route: base, gameType: null };
}

function defaultBackTarget(route) {
  const activities = ["daily", "mood", "timeline", "playlist", "draw", "wyr", "bucket", "quiz", "scrapbook", "jar"];
  if (["chat", "notes", "moments", "watch", "call", "games", "more", "look", "profile"].includes(route)) {
    return { route: "home" };
  }
  if (route === "search" || route === "calendar" || route === "favorites" || activities.includes(route)) {
    return { route: "home" };
  }
  return { route: "home" };
}

function navigateBack() {
  const back = S.backTo || defaultBackTarget(S.route);
  if (back.route === "games" && back.lobby) {
    go("games", { lobby: true, force: true });
    return;
  }
  go(back.route, { force: true });
}

function setBackTarget(target) {
  S.backTo = target;
}

function screenBar(title, eyebrow) {
  const back = S.backTo?.route === "games" ? "Games" : "Hub";
  return `<header class="activity-bar glass">
    <button class="bar-btn" type="button" data-act="nav-back" aria-label="Back to ${esc(back)}">←</button>
    <div class="activity-bar-title"><span class="eyebrow">${esc(eyebrow)}</span><strong>${esc(title)}</strong></div>
    <button class="bar-btn" type="button" data-act="go" data-route="home" aria-label="Home">⌂</button>
  </header>`;
}

function guard(route) {
  if (route === "pair") route = "bubbles";
  const known = [
    "landing", "auth", "bubbles", "home", "chat", "notes", "moments", "watch", "games", "call", "profile", "look", "more",
    "daily", "mood", "timeline", "playlist", "draw", "wyr", "bucket", "calendar", "favorites",
    "quiz", "scrapbook", "jar", "search",
  ];
  if (!known.includes(route)) route = S.user ? "bubbles" : "landing";
  if (!S.user) return route === "auth" ? "auth" : "landing";
  const inside = S.bubble && S.bubble.status === "active";
  if (!inside && !["bubbles", "profile", "look"].includes(route)) return "bubbles";
  if (inside && ["landing", "auth"].includes(route)) return "home";
  return route;
}

function rememberBubble(id) {
  S.bubbleId = id || 0;
  if (S.bubbleId) sessionStorage.setItem("buzz-bubble", String(S.bubbleId));
  else sessionStorage.removeItem("buzz-bubble");
}

async function refreshState() {
  const data = await api("state", { query: S.bubbleId ? { bubble: S.bubbleId } : null });
  const pendingLook = lookFlight > 0 && S.user ? S.user.appearance : null;
  S.user = data.user;
  if (pendingLook && S.user) S.user.appearance = pendingLook;
  S.bubbles = data.bubbles || [];
  S.bubble = data.bubble;
  S.preview = data.preview;
  if (S.user) rememberBubble(data.bubble?.id || 0);
  if (data.serverNow) S.clockOffset = data.serverNow - Date.now() / 1000;
  S.badges = data.badges || { bubbles: 0, chat: 0, notes: 0, moments: 0, watch: 0, games: 0 };
  if (S.bubble?.id && !S.hubNotify) {
    api("activity", { query: { key: "hub" } })
      .then((hub) => {
        S.hubNotify = hub.activity?.notify || {};
      })
      .catch(() => {});
  }
  paintBadges();
  const editing = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.lookColor;
  if (!editing) applyLook();
}

function badgeCount(route) {
  const b = S.badges || {};
  if (route === "bubbles") return b.bubbles || 0;
  if (route === "chat") return b.chat || 0;
  if (route === "notes") return b.notes || 0;
  if (route === "moments") return b.moments || 0;
  if (route === "watch") return b.watch || 0;
  if (route === "games") return b.games || 0;
  if (route === "more") return (b.games || 0) + (b.moments || 0) + (b.watch || 0);
  return 0;
}

function paintBadges() {
  const prev = S.badgePrev || {};
  document.querySelectorAll("[data-badge-route]").forEach((el) => {
    const route = el.dataset.badgeRoute;
    const count = badgeCount(route);
    const before = prev[route] || 0;
    let badge = el.querySelector(".nav-badge");
    if (!count) {
      if (badge && before > 0) {
        badge.classList.add("badge-fade");
        window.setTimeout(() => badge.remove(), 480);
      } else {
        badge?.remove();
      }
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "nav-badge";
      el.appendChild(badge);
    }
    badge.textContent = count > 9 ? "9+" : String(count);
    if (count > before) {
      badge.classList.remove("badge-bump");
      void badge.offsetWidth;
      badge.classList.add("badge-bump");
    }
  });
  S.badgePrev = {
    bubbles: badgeCount("bubbles"),
    chat: badgeCount("chat"),
    notes: badgeCount("notes"),
    moments: badgeCount("moments"),
    watch: badgeCount("watch"),
    games: badgeCount("games"),
    more: badgeCount("more"),
  };
}

const BADGE_NAV_ROUTES = new Set(["bubbles", "chat", "notes", "moments", "watch", "games"]);

function navButtonHtml(route, label, ic) {
  const badgeAttr = BADGE_NAV_ROUTES.has(route) ? ` data-badge-route="${route}"` : "";
  const lobby = route === "games" ? ` data-lobby="1"` : "";
  return `<button class="nav-btn ${navClass(route)}" type="button" data-act="go" data-route="${route}"${lobby}${badgeAttr}>${icon(ic)}<span class="nav-label">${label}</span></button>`;
}

function tabButtonHtml(route, label, ic) {
  const badgeRoute = route === "bubbles" || route === "chat" || route === "notes" || route === "more" ? route : "";
  const badgeAttr = badgeRoute ? ` data-badge-route="${badgeRoute}"` : "";
  const lobby = route === "games" ? ` data-lobby="1"` : "";
  return `<button class="tab-btn ${navClass(route)}" type="button" data-act="go" data-route="${route}"${lobby}${badgeAttr}>${icon(ic)}<span>${label}</span></button>`;
}

async function markSectionSeen(section) {
  if (!S.bubble || S.bubble.status !== "active") return;
  const action = `${section}_seen`;
  if (!["notes", "chat", "moments", "watch"].includes(section)) return;
  try {
    const data = await api(action, { method: "POST", json: {} });
    if (data.badges) S.badges = data.badges;
    paintBadges();
  } catch {
    /* ignore */
  }
}

function bubblesSig() {
  return (S.bubbles || []).map((bubble) => `${bubble.id}:${bubble.status}:${bubble.snippet || ""}:${bubble.nextVisitAt || ""}:${bubble.daysTogether || 0}`).join("|");
}

async function go(route, opts = {}) {
  if (S.navLock) return;
  let next = guard(route);
  const lobby = !!opts.lobby;
  let gameType = opts.gameType !== undefined ? opts.gameType : null;
  if (next === "games") {
    if (lobby) gameType = null;
    else if (opts.gameType) gameType = opts.gameType;
    else if (!opts.fromHash && !opts.keepGame) gameType = null;
    else gameType = gameType || S.gameType;
  } else {
    gameType = null;
  }
  const sameView = S.renderedRoute === next && (next !== "games" || S.gameType === gameType);
  if (!opts.force && sameView) {
    const want = routeHash(next, gameType);
    if (location.hash !== "#" + want) location.hash = want;
    return;
  }
  S.navLock = true;
  document.body.classList.add("is-navigating");
  try {
  if (S.user && !S.stateReady) {
    try {
      await refreshState();
      S.stateReady = true;
    } catch (err) {
      S.error = err.message || "Something went wrong.";
    }
  }
  next = guard(route);
  if (next === "games") {
    if (lobby) gameType = null;
    else if (opts.gameType) gameType = opts.gameType;
    else if (!opts.fromHash && !opts.keepGame) gameType = null;
    else gameType = gameType || S.gameType;
  } else {
    gameType = null;
  }
  if (!opts.skipBack && opts.backTo) S.backTo = opts.backTo;
  else if (!opts.skipBack && !opts.fromHash && next !== S.route) {
    if (!["landing", "auth", "bubbles", "home"].includes(next)) {
      S.backTo = S.backTo || defaultBackTarget(next);
    }
  }
  S.route = next;
  S.gameType = next === "games" ? gameType : null;
  if (next !== "games" || !gameType) {
    if (next !== "games") {
      S.game = null;
      S.turnHadMine = undefined;
    }
    if (lobby) {
      S.game = null;
      S.turnHadMine = undefined;
    }
  }
  S.uiGameMenu = false;
  S.askLeave = false;
  if (!opts.keepError) S.error = "";
  S.flash = opts.keepFlash ? S.flash : "";
  try {
    if (S.user && ["home", "bubbles", "profile"].includes(next)) await refreshState();
    const guarded = guard(S.route);
    S.route = guarded;
    if (S.route === "chat") S.chat = (await api("messages")).messages;
    if (S.route === "notes") {
      S.notes = (await api("notes")).notes;
      S.notesSig = S.notes.map((note) => note.id).join(",");
    }
    if (S.route === "moments") {
      S.moments = (await api("moments")).moments;
      S.momentsSig = S.moments.map((moment) => moment.id).join(",");
      S.momentsReactSig = momentReactSig(S.moments);
    }
    if (S.route === "games" && S.gameType) {
      S.game = (await api("game", { query: { type: S.gameType } })).game;
      S.selected = S.game.mustFrom || null;
      S.turnHadMine = undefined;
      checkTurnNotify(S.game);
    }
    if (S.route === "games" && !S.gameType) {
      const list = await api("games_list");
      S.gamesLobby = list.games || [];
    }
    if (S.route === "watch") {
      const data = await api("watch");
      S.watch = data.watch;
      S.clockOffset = data.serverNow - Date.now() / 1000;
    }
    if (ACTIVITY_KEYS.has(S.route) || S.route === "calendar" || S.route === "favorites") {
      await ensureActivityRoute(S.route);
    }
    if (S.route === "look") {
      await loadActivity("hub");
    }
  } catch (err) {
    S.error = err.message || "Something went wrong.";
    if (!S.user) S.route = "landing";
  }
  const hash = routeHash(S.route, S.gameType);
  if (!S.hashNav && location.hash !== "#" + hash) location.hash = hash;
  S.renderedRoute = S.route;
  render();
  } finally {
    S.navLock = false;
    document.body.classList.remove("is-navigating");
    S.hashNav = false;
  }
}

function navClass(route) {
  if (route === "more") return ["watch", "games", "call", "profile", "look", "more"].includes(S.route) ? "on" : "";
  return S.route === route ? "on" : "";
}

function landingScreen() {
  const features = [
    ["💬", "Chat", "A calm thread that belongs only to the two of you."],
    ["🎬", "Watch together", "YouTube in sync, with video chat on the side."],
    ["🎮", "Games & activities", "Board games, quizzes, daily questions, mood check-ins, and more."],
    ["📸", "Moments & notes", "Photos with reactions, pinned love notes, and favorites."],
    ["🫧", "Multiple bubbles", "A separate private space for each person — nothing mixes."],
    ["🎨", "Your look", "Themes, layouts, animations, and per-bubble alerts."],
  ];
  return `<div class="landing">
    <header class="land-bar">
      <div class="brand">${mark("full")}</div>
      <button class="btn ghost" type="button" data-act="go" data-route="auth" data-mode="login">Sign in</button>
    </header>
    <section class="hero">
      <div>
        <p class="eyebrow">For two, any distance</p>
        <h1>A private bubble for two, however far apart.</h1>
        <p class="lede">Chat, watch together, play games, share moments and keep your love close.</p>
        <div class="hero-actions">
          <button class="btn rose" type="button" data-act="go" data-route="auth" data-mode="register">Create your bubble</button>
          <button class="btn ghost" type="button" data-act="go" data-route="auth" data-mode="login">I already have one</button>
        </div>
        <ol class="onboard-steps">
          <li><span class="step-n">1</span><span>Pick a username</span></li>
          <li><span class="step-n">2</span><span>Invite your partner</span></li>
          <li><span class="step-n">3</span><span>Open your bubble together</span></li>
        </ol>
        ${S.bootError ? `<p class="error">${esc(S.bootError)}</p>` : ""}
      </div>
      <div class="phone" aria-hidden="true">
        <div class="phone-top"><strong>You & yours</strong><span>♥ in sync</span></div>
        ${mascotHtml("idle")}
        <div class="mini-note">Miss you. Movie tonight? 🎬</div>
        <div class="mini-row"><span class="on">💬</span><span>📸</span><span>🎮</span></div>
      </div>
    </section>
    <section class="feature-grid landing-features">
      ${features.map(([icon, title, copy]) => `<article class="feature glass-card"><span class="feature-icon" aria-hidden="true">${icon}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join("")}
    </section>
  </div>`;
}

function fieldIcon(name) {
  const paths = {
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c1.2-3.4 3.4-5 6.5-5s5.3 1.6 6.5 5"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m5 8 7 5 7-5"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/>',
  };
  return `<svg class="field-ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function friendlyAuthError(message) {
  const raw = String(message || "");
  const map = [
    [/valid email|email looks/i, "That email looks off."],
    [/already registered/i, "That email already has a bubble — try signing in."],
    [/does not match/i, "Email or password doesn’t match."],
    [/at least 8/i, "Use at least 8 characters for your password."],
    [/at least 6/i, "Use at least 6 characters for your password."],
    [/expired/i, "That code has expired. Send a new one."],
    [/too many/i, "Too many tries. Send a new code."],
    [/isn.t right|isn't right/i, "That code isn’t right, try again."],
  ];
  for (const [re, copy] of map) {
    if (re.test(raw)) return copy;
  }
  return raw || "Something went wrong.";
}

function authValid(form) {
  if (!form) return false;
  const email = String(form.email?.value || "").trim();
  const password = String(form.password?.value || "");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const nameOk = form.name ? String(form.name.value || "").trim().length > 0 : true;
  return emailOk && password.length >= 6 && nameOk;
}

function syncAuthSubmitState() {
  const form = document.getElementById("auth-form");
  const btn = form?.querySelector('[type="submit"]');
  if (!form || !btn) return;
  let ok = false;
  if (form.dataset.form === "forgot") {
    ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email?.value || "").trim());
  } else if (form.dataset.form === "verify-code") {
    ok = collectResetCode().length === 6;
  } else if (form.dataset.form === "reset-password") {
    const a = String(form.password?.value || "");
    const b = String(form.passwordConfirm?.value || "");
    ok = a.length >= 8 && a === b;
  } else {
    ok = authValid(form);
  }
  btn.disabled = !ok || btn.classList.contains("is-loading");
  btn.classList.toggle("is-ready", ok && !btn.classList.contains("is-loading"));
}

function collectResetCode() {
  return Array.from(document.querySelectorAll(".code-box")).map((el) => el.value.replace(/\D/g, "")).join("").slice(0, 6);
}

function maskResetEmail(email) {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function passwordStrengthHint(pw) {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length < 10) return "Getting there — a little longer is nicer.";
  if (!/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) return "Stronger with letters and a number.";
  return "Looks good.";
}

function resetCountdownLabel() {
  const left = Math.max(0, Math.floor((S.resetExpiresAt - Date.now()) / 1000));
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return left > 0 ? `${m}:${s} left` : "Code expired";
}

function resetCooldownLeft() {
  return Math.max(0, Math.ceil((S.resetCooldownUntil - Date.now()) / 1000));
}

function wireResetCodeBoxes() {
  const boxes = Array.from(document.querySelectorAll(".code-box"));
  if (!boxes.length) return;
  boxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      const v = box.value.replace(/\D/g, "").slice(-1);
      box.value = v;
      if (v && boxes[i + 1]) boxes[i + 1].focus();
      syncAuthSubmitState();
    });
    box.addEventListener("keydown", (ev) => {
      if (ev.key === "Backspace" && !box.value && boxes[i - 1]) {
        boxes[i - 1].focus();
      }
    });
    box.addEventListener("paste", (ev) => {
      const text = (ev.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!text) return;
      ev.preventDefault();
      text.split("").forEach((ch, idx) => {
        if (boxes[idx]) boxes[idx].value = ch;
      });
      boxes[Math.min(text.length, 5)].focus();
      syncAuthSubmitState();
    });
  });
  boxes[0].focus();
}

function startResetTicker() {
  if (S.resetTick) window.clearInterval(S.resetTick);
  S.resetTick = window.setInterval(() => {
    if (S.route !== "auth" || !S.resetStep) {
      window.clearInterval(S.resetTick);
      S.resetTick = 0;
      return;
    }
    const cd = document.getElementById("reset-countdown");
    if (cd) cd.textContent = resetCountdownLabel();
    const resend = document.getElementById("resend-code");
    if (resend) {
      const wait = resetCooldownLeft();
      resend.disabled = wait > 0;
      resend.textContent = wait > 0 ? `Resend code (${wait}s)` : "Resend code";
    }
  }, 1000);
}

function resetScreen() {
  const step = S.resetStep;
  const backBtn = `<button class="btn ghost auth-back" type="button" data-act="reset-back">← Back</button>`;
  const toSignIn = `<p class="auth-forgot"><button class="text-btn" type="button" data-act="auth-tab" data-mode="login">Back to sign in</button></p>`;
  if (step === "request") {
    return `<div class="auth-wrap">
      ${backBtn}
      <div class="auth-card">
        <div class="brand brand-center">${mark("full")}</div>
        <h1 class="auth-headline">Reset your password</h1>
        <p class="auth-sub">We’ll email a 6-digit code if that address has a bubble.</p>
        ${errorHtml()}${flashHtml()}
        <form id="auth-form" data-form="forgot" class="stack" novalidate>
          <div class="field icon-field">
            <label for="email">Email</label>
            ${fieldIcon("mail")}
            <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" value="${esc(S.resetEmail)}">
            <p class="field-hint" data-hint="email" hidden></p>
          </div>
          <button class="btn rose auth-submit" type="submit" disabled>Send me a code</button>
        </form>
        ${toSignIn}
      </div>
    </div>`;
  }
  if (step === "verify") {
    const boxes = Array.from({ length: 6 }, (_, i) => `<input class="code-box" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i === 0 ? "one-time-code" : "off"}" aria-label="Digit ${i + 1}">`).join("");
    const wait = resetCooldownLeft();
    return `<div class="auth-wrap">
      ${backBtn}
      <div class="auth-card">
        <div class="brand brand-center">${mark("full")}</div>
        <h1 class="auth-headline">Enter your code</h1>
        <p class="auth-sub">Code sent to ${esc(S.resetMask || maskResetEmail(S.resetEmail))}</p>
        <p class="auth-username-note" id="reset-countdown">${esc(resetCountdownLabel())}</p>
        ${errorHtml()}${flashHtml()}
        <form id="auth-form" data-form="verify-code" class="stack" novalidate>
          <div class="code-row">${boxes}</div>
          <p class="field-hint" data-hint="code" hidden></p>
          <button class="btn rose auth-submit" type="submit" disabled>Verify code</button>
        </form>
        <p class="auth-forgot"><button class="text-btn" type="button" data-act="resend-code" id="resend-code" ${wait > 0 ? "disabled" : ""}>${wait > 0 ? `Resend code (${wait}s)` : "Resend code"}</button></p>
        ${toSignIn}
      </div>
    </div>`;
  }
  return `<div class="auth-wrap">
    ${backBtn}
    <div class="auth-card">
      <div class="brand brand-center">${mark("full")}</div>
      <h1 class="auth-headline">Choose a new password</h1>
      <p class="auth-sub">Use at least 8 characters. Then you’re back in.</p>
      ${errorHtml()}${flashHtml()}
      <form id="auth-form" data-form="reset-password" class="stack" novalidate>
        <div class="field icon-field">
          <label for="password">New password</label>
          ${fieldIcon("lock")}
          <input id="password" name="password" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters">
          <button class="pw-toggle" type="button" data-act="toggle-password" aria-label="Show password">Show</button>
          <p class="field-hint" data-hint="password" hidden></p>
          <p class="auth-username-note" id="pw-strength"></p>
        </div>
        <div class="field icon-field">
          <label for="passwordConfirm">Confirm password</label>
          ${fieldIcon("lock")}
          <input id="passwordConfirm" name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password" placeholder="Type it again">
          <button class="pw-toggle" type="button" data-act="toggle-password" data-for="passwordConfirm" aria-label="Show password">Show</button>
          <p class="field-hint" data-hint="confirm" hidden></p>
        </div>
        <button class="btn rose auth-submit" type="submit" disabled>Update password</button>
      </form>
      ${toSignIn}
    </div>
  </div>`;
}

function authScreen() {
  if (S.resetStep) return resetScreen();
  const register = S.authMode !== "login";
  const nameField = register
    ? `<div class="field icon-field">
        <label for="name">Your name</label>
        ${fieldIcon("person")}
        <input id="name" name="name" maxlength="40" required autocomplete="name" placeholder="Your name">
        <p class="field-hint" data-hint="name" hidden></p>
      </div>`
    : "";
  return `<div class="auth-wrap">
    <button class="btn ghost auth-back" type="button" data-act="go" data-route="landing">← Back</button>
    <div class="auth-card">
      <div class="brand brand-center">${mark("full")}</div>
      <h1 class="auth-headline">Your private bubble for two.</h1>
      <p class="auth-sub">A private bubble for two, however far apart.</p>
      ${register ? `<div class="auth-steps">
        <div class="auth-step"><span class="step-n">1</span><strong>Pick your name</strong></div>
        <div class="auth-step"><span class="step-n">2</span><strong>Invite your partner</strong></div>
        <div class="auth-step"><span class="step-n">3</span><strong>Chat, watch &amp; play</strong></div>
      </div>
      <p class="auth-username-note">You'll get a fun username automatically, and you can change it anytime.</p>` : `<p class="auth-welcome">Welcome back — pick up where you left off.</p>`}
      <div class="tabs auth-tabs">
        <button class="tab ${register ? "on" : ""}" type="button" data-act="auth-tab" data-mode="register">Create</button>
        <button class="tab ${register ? "" : "on"}" type="button" data-act="auth-tab" data-mode="login">Sign in</button>
      </div>
      ${errorHtml()}
      <form id="auth-form" data-form="${register ? "register" : "login"}" class="stack" novalidate>
        ${nameField}
        <div class="field icon-field">
          <label for="email">Email</label>
          ${fieldIcon("mail")}
          <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
          <p class="field-hint" data-hint="email" hidden></p>
        </div>
        <div class="field icon-field">
          <label for="password">Password</label>
          ${fieldIcon("lock")}
          <input id="password" name="password" type="password" minlength="6" required autocomplete="${register ? "new-password" : "current-password"}" placeholder="At least 8 characters">
          <button class="pw-toggle" type="button" data-act="toggle-password" aria-label="Show password">Show</button>
          <p class="field-hint" data-hint="password" hidden></p>
        </div>
        <button class="btn rose auth-submit" type="submit" disabled>${register ? "Create my bubble" : "Sign in"}</button>
      </form>
      ${register ? "" : `<p class="auth-forgot"><button class="text-btn" type="button" data-act="forgot-password">Forgot password?</button></p>`}
      <p class="auth-private">Private by design. Your bubble is only for the two of you. <a href="terms.php" target="_blank" rel="noopener">Terms</a> · <a href="privacy.php" target="_blank" rel="noopener">Privacy</a></p>
    </div>
    <div class="auth-features">
      <span>💬 Chat</span>
      <span>🎬 Watch together</span>
      <span>🎮 Play games</span>
      <span>📸 Share moments</span>
    </div>
  </div>`;
}

function momentSrc(id) {
  return `api.php?action=moment_image&id=${id}&bubble=${S.bubble?.id || 0}`;
}

function bubbleListHtml() {
  const rows = S.bubbles || [];
  if (!rows.length) return `<div class="empty empty-illo">${mascotHtml("wait")}<p>No bubbles yet. Invite someone you miss — your first hello is waiting.</p></div>`;
  return rows.map((bubble, i) => {
    const partner = bubble.partner;
    const grad = `bubble-tone-${(i % 3) + 1}`;
    if (bubble.status === "active") {
      const snippet = bubble.snippet ? esc(bubble.snippet) : "Tap to say hello 💬";
      const meta = esc(daysTogetherLabel(bubble));
      const visit = bubble.nextVisitAt ? ` · ${esc(visitCountdownLabel(bubble.nextVisitAt))}` : "";
      const current = bubble.id === S.bubble?.id ? " on" : "";
      return `<button class="bubble-card glass-card ${grad}${current}" type="button" data-act="open-bubble" data-id="${bubble.id}">
        <span class="bubble-ava-pair">${ava(S.user?.displayName || "You")}${ava(partner.displayName)}</span>
        <span class="grow"><strong>${esc(partner.displayName)}</strong><p class="bubble-meta">${meta}${visit}</p><p class="bubble-preview">@${esc(partner.username)} · ${snippet}</p></span>
      </button>`;
    }
    if (bubble.incoming) {
      return `<article class="card bubble-row">
        ${ava(partner.displayName)}
        <span class="grow"><strong>${esc(partner.displayName)} invited you</strong><p>@${esc(partner.username)}</p></span>
        <button class="btn rose" type="button" data-act="accept" data-id="${bubble.id}">Accept</button>
        <button class="btn ghost" type="button" data-act="decline" data-id="${bubble.id}">Not now</button>
      </article>`;
    }
    return `<article class="card bubble-row">
      ${ava(partner.displayName)}
      <span class="grow"><strong>Waiting for ${esc(partner.displayName)}</strong><p>@${esc(partner.username)}</p></span>
      <button class="btn ghost" type="button" data-act="cancel-invite" data-id="${bubble.id}">Cancel</button>
    </article>`;
  }).join("");
}

function bubblesScreen() {
  const intro = S.bubble && S.bubble.status === "active"
    ? `<p class="empty">Your username is @${esc(S.user.username)}. Each person below has a separate chat, notes, photos, and calls.</p>`
    : `<p class="eyebrow">Step 1 — your username</p>
      <p class="username-xl">@${esc(S.user.username)}</p>
      <div class="row"><button class="btn soft" type="button" data-act="copy-user">Copy for your partner</button></div>
      <form data-form="username" class="username-form">
        <input name="username" value="${esc(S.user.username)}" maxlength="20" aria-label="Change username" autocapitalize="none">
        <button class="btn ghost" type="submit">Save</button>
      </form>
      <p class="empty">Step 2 — invite them below. Each bubble stays private and separate.</p>`;
  return `${errorHtml()}${flashHtml()}
    <p class="eyebrow">Your bubbles</p>
    <h2>Who you're close with</h2>
    ${intro}
    <div id="bubble-list" class="stack">${bubbleListHtml()}</div>
    <form data-form="invite" class="stack gap-top">
      <div class="field"><label for="partner">Their username</label><input id="partner" name="username" autocapitalize="none" autocomplete="off" placeholder="partner's @username" required></div>
      <button class="btn rose" type="submit">${(S.bubbles || []).length ? "Invite someone else" : "Invite your partner"}</button>
    </form>`;
}

function quickActions() {
  const items = [
    ["chat", "Chat", "Say something"],
    ["notes", "Notes", "Leave a note"],
    ["moments", "Moments", "Share a photo"],
    ["watch", "Watch", "A video together"],
    ["games", "Play", "Board games and quizzes"],
    ["call", "Call", "See each other"],
  ];
  return `<div class="quick">${items.map(([route, title, sub]) => `<button class="qbtn" type="button" data-act="go" data-route="${route}"><strong>${title}</strong><span>${sub}</span></button>`).join("")}</div>`;
}

function homeScreen() {
  const hero = hubHeroHtml();
  if (typeof BuzzActivities !== "undefined") return BuzzActivities.hubHome(S.badges, hero, hubCardPreviews());
  return `${errorHtml()}${flashHtml()}<p class="empty">Almost there…</p>`;
}

const ACTIVITY_KEYS = new Set(["daily", "mood", "timeline", "playlist", "draw", "wyr", "bucket", "quiz", "scrapbook", "jar"]);

async function loadActivity(key) {
  S.activityKey = key;
  const data = await api("activity", { query: { key } });
  S.activity = data.activity;
  if (key === "hub" && S.activity?.notify) S.hubNotify = S.activity.notify;
  return S.activity;
}

function hubNotifyMuted(key) {
  const notify = S.hubNotify || (S.activityKey === "hub" ? S.activity?.notify : null);
  return !!notify?.[key]?.mute;
}

async function activityAction(payload) {
  if (!S.activityKey) return null;
  if (!S.activity) await loadActivity(S.activityKey);
  const data = await api("activity_action", {
    method: "POST",
    json: { key: S.activityKey, version: S.activity?.version ?? 0, ...payload },
  });
  S.activity = data.activity;
  paintActivityScreen();
  return S.activity;
}

function paintActivityScreen() {
  const key = S.activityKey;
  if (!key || typeof BuzzActivities === "undefined") return;
  const root = document.getElementById("activity-root");
  if (!root) return;
  const fn = BuzzActivities.screens[key];
  if (!fn) return;
  const html = key === "timeline" ? fn(S.timelineFeed) : key === "calendar" || key === "favorites" ? fn(S.activity) : fn(S.activity);
  const shell = root.closest(".activity-layout");
  if (shell) {
    const wrap = document.createElement("div");
    wrap.innerHTML = fn === BuzzActivities.screens.timeline ? BuzzActivities.screens.timeline(S.timelineFeed) : fn(S.activity);
    const newMain = wrap.querySelector(".activity-main") || wrap.firstElementChild;
    if (newMain && newMain.id === "activity-root") {
      root.innerHTML = newMain.innerHTML;
    } else {
      root.innerHTML = wrap.innerHTML;
    }
  }
  if (key === "draw") setupDrawCanvas();
}

async function ensureActivityRoute(route) {
  if (!ACTIVITY_KEYS.has(route) && route !== "calendar" && route !== "favorites") return;
  if (route === "timeline") {
    S.timelineFeed = await api("timeline_feed");
  }
  const apiKey = route === "calendar" || route === "favorites" ? "hub" : route;
  await loadActivity(apiKey);
  S.activityKey = apiKey;
  const comments = await api("activity_comments", { query: { key: apiKey } });
  S.activityComments[apiKey] = comments.comments || [];
}

function activityScreen(route) {
  const key = route === "calendar" || route === "favorites" ? "hub" : route;
  if (typeof BuzzActivities === "undefined") return `${errorHtml()}<p class="empty">Loading…</p>`;
  if (route === "timeline") return BuzzActivities.screens.timeline(S.timelineFeed || { items: [], onThisDay: [] });
  if (route === "calendar") return BuzzActivities.screens.calendar(S.activity || {});
  if (route === "favorites") return BuzzActivities.screens.favorites(S.activity || {});
  const fn = BuzzActivities.screens[route];
  return fn ? fn(S.activity || {}) : `${errorHtml()}<p class="empty">Coming soon.</p>`;
}

function paintActivityComments() {
  const key = S.activityKey;
  if (!key) return;
  const list = document.getElementById("activity-msgs");
  if (!list) return;
  const comments = S.activityComments[key] || [];
  list.innerHTML = comments.length
    ? comments.map((c) => {
        const mine = c.senderId === S.user.id;
        return `<div class="watch-msg ${mine ? "mine" : "theirs"}"><strong>${esc(whoName(c.senderId))}</strong>${formatChatBody(c.body)}<time>${esc(clock(c.createdAt))}</time></div>`;
      }).join("")
    : `<p class="empty">Side chat for this activity.</p>`;
  list.scrollTop = list.scrollHeight;
}

async function pullActivityComments() {
  const key = S.activityKey;
  if (!key || !ACTIVITY_KEYS.has(key) && key !== "hub") return;
  const chatKey = key === "hub" ? S.route === "favorites" ? "hub" : "hub" : key;
  const since = (S.activityComments[chatKey] || []).length ? S.activityComments[chatKey][S.activityComments[chatKey].length - 1].id : 0;
  const data = await api("activity_comments", { query: { key: chatKey, since: since || undefined } });
  if (!data.comments.length && since === 0) return;
  if (since === 0) S.activityComments[chatKey] = data.comments;
  else S.activityComments[chatKey].push(...data.comments);
  paintActivityComments();
}

async function pullActivityState() {
  const route = S.route;
  if (!ACTIVITY_KEYS.has(route) && route !== "calendar" && route !== "favorites") return;
  const key = route === "calendar" || route === "favorites" ? "hub" : route;
  const prev = S.activity?.version;
  const data = await api("activity", { query: { key } });
  if (route === "timeline") {
    const feed = await api("timeline_feed");
    S.timelineFeed = feed;
  }
  S.activity = data.activity;
  S.activityKey = key;
  if (prev !== undefined && data.activity.version > prev) {
    const root = document.getElementById("activity-root");
    if (root && typeof BuzzActivities !== "undefined") {
      const fn = route === "timeline" ? BuzzActivities.screens.timeline : BuzzActivities.screens[route] || BuzzActivities.screens[key];
      if (fn) {
        const full = route === "timeline" ? fn(S.timelineFeed) : fn(S.activity);
        const tmp = document.createElement("div");
        tmp.innerHTML = full;
        const inner = tmp.querySelector("#activity-root");
        if (inner) root.innerHTML = inner.innerHTML;
      }
    }
    if (route === "draw") redrawDrawCanvas();
  }
  await pullActivityComments();
}

function redrawDrawCanvas() {
  const canvas = document.getElementById("draw-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const strokes = S.activity?.strokes || [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach((stroke) => {
    const pts = stroke.points || [];
    if (pts.length < 2) return;
    ctx.strokeStyle = stroke.color || "#e85d6f";
    ctx.lineWidth = stroke.width || 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] * canvas.width;
      const y = p[1] * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

function setupDrawCanvas() {
  const canvas = document.getElementById("draw-canvas");
  if (!canvas) return;
  redrawDrawCanvas();
  if (canvas.dataset.bound) return;
  canvas.dataset.bound = "1";
  const drawAll = () => redrawDrawCanvas();
  let drawing = false;
  let points = [];
  const norm = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  };
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    points = [norm(e)];
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    points.push(norm(e));
  });
  canvas.addEventListener("pointerup", async () => {
    if (!drawing || points.length < 2) {
      drawing = false;
      return;
    }
    drawing = false;
    try {
      await activityAction({ action: "stroke", stroke: { color: S.drawColor, width: 4, points } });
      S.drawStrokes = S.activity?.strokes || [];
      drawAll();
    } catch (err) {
      showError(err.message);
    }
    points = [];
  });
}

async function markActivitySeen() {
  const key = S.activityKey || (ACTIVITY_KEYS.has(S.route) ? S.route : null);
  if (!key) return;
  try {
    const data = await api("activity_seen", { method: "POST", json: { key } });
    if (data.badges) S.badges = data.badges;
    paintBadges();
  } catch {
    /* ignore */
  }
}

async function runDateNight() {
  const picks = [
    ["watch", "watch", "Queue a cozy watch"],
    ["games", "games", "Play something quick"],
    ["daily", "daily", "Answer today's question"],
    ["wyr", "wyr", "Quick match game"],
    ["draw", "draw", "Doodle together"],
  ];
  const [route, key, label] = picks[Math.floor(Math.random() * picks.length)];
  showFlash(`Date night: ${label}`);
  if (route === "games") {
    await go("games", { force: true });
    return;
  }
  await go(route, { force: true });
  if (ACTIVITY_KEYS.has(route)) await ensureActivityRoute(route);
}

function msgsHtml(list) {
  let html = "";
  let lastDay = "";
  list.forEach((message) => {
    const day = dayLabel(message.createdAt);
    if (day !== lastDay) {
      html += `<div class="day">${esc(day)}</div>`;
      lastDay = day;
    }
    const mine = message.senderId === S.user.id;
    html += `<div class="msg ${mine ? "mine" : "theirs"}">${formatChatBody(message.body)}<time>${esc(clock(message.createdAt))}</time></div>`;
  });
  return html || `<div class="empty empty-illo">${mascotHtml("wait")}<p>Your chat is waiting — say something lovely.</p></div>`;
}

function appendChatMessage(message) {
  const list = document.getElementById("msgs");
  if (!list) return;
  const empty = list.querySelector(".empty");
  if (empty) empty.remove();
  const mine = message.senderId === S.user.id;
  const div = document.createElement("div");
  div.className = `msg ${mine ? "mine" : "theirs"}${effectsOn() ? " msg-pop" : ""}`;
  div.innerHTML = `${formatChatBody(message.body)}<time>${esc(clock(message.createdAt))}</time>`;
  list.appendChild(div);
}

function chatScreen() {
  return `<div class="pane-chat">
    ${errorHtml()}${screenBar(partnerName(), "Chat")}
    <div class="chat-body">
      <aside class="chat-rail">
        <p class="eyebrow">Bubbles</p>
        ${peopleNav()}
      </aside>
      <div class="chat-thread">
        ${partnerStatusHtml()}
        <div id="msgs" class="msgs">${msgsHtml(S.chat)}</div>
        ${chatComposerHtml("chat", { max: 1000, placeholder: `Write to ${partnerName()}` })}
      </div>
    </div>
  </div>`;
}

function notesHtml() {
  if (!S.notes.length) return `<div class="empty empty-illo">${mascotHtml("wait")}<p>No notes yet. Write the first one 💌</p></div>`;
  return S.notes.map((note) => `<article class="note" style="background:${NOTE_COLORS[note.color] || NOTE_COLORS.blush}">
      <div class="who">${esc(whoName(note.authorId))} · ${esc(dayLabel(note.createdAt))}</div>
      <p>${escBr(note.content)}</p>
      <button class="text-btn" type="button" data-act="favorite" data-type="note" data-id="${note.id}" data-label="${esc(note.content.slice(0, 40).replace(/"/g, ""))}">★ Favorite</button>
      ${note.authorId === S.user.id ? `<button class="text-btn" type="button" data-act="delete-note" data-id="${note.id}">Remove</button>` : ""}
    </article>`).join("");
}

function notesScreen() {
  const swatches = Object.entries(NOTE_COLORS).map(([name, hex]) => `<button class="swatch ${S.noteColor === name ? "on" : ""}" type="button" style="background:${hex}" data-act="swatch" data-color="${name}" aria-label="${name}"></button>`).join("");
  return `${errorHtml()}${flashHtml()}${screenBar("Leave something behind", "Notes")}
    <form data-form="note" class="stack">
      <textarea name="content" maxlength="500" placeholder="A thought, a reminder, a little I love you"></textarea>
      <div class="swatches">${swatches}</div>
      <button class="btn rose" type="submit">Pin note</button>
    </form>
    <div id="note-grid" class="note-grid gap-top">${notesHtml()}</div>`;
}

function momentReactionSummary(moment) {
  const counts = moment.reactionCounts || {};
  const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([emoji, n]) => `${emoji} ${n}`);
  return parts.length ? parts.join(" · ") : "";
}

function momentCommentsHtml(moment) {
  const comments = S.momentComments[moment.id] || [];
  if (!comments.length) return `<p class="empty">No comments yet.</p>`;
  return comments.map((comment) => {
    const mine = comment.senderId === S.user.id;
    return `<div class="watch-msg ${mine ? "mine" : "theirs"}"><strong>${esc(whoName(comment.senderId))}</strong>${formatChatBody(comment.body)}<time>${esc(clock(comment.createdAt))}</time></div>`;
  }).join("");
}

function momentCardHtml(moment) {
  const open = S.momentOpen === moment.id;
  const summary = momentReactionSummary(moment);
  const reacts = MOMENT_REACTS.map((emoji) => {
    const on = moment.myReaction === emoji ? "on" : "";
    return `<button type="button" class="moment-react ${on}" data-act="moment-react" data-id="${moment.id}" data-emoji="${emoji}" aria-label="React ${emoji}">${emoji}</button>`;
  }).join("");
  const commentBtn = `<button class="text-btn moment-comment-toggle" type="button" data-act="moment-comments" data-id="${moment.id}">${moment.commentCount ? `${moment.commentCount} comment${moment.commentCount === 1 ? "" : "s"}` : "Comment"}</button>`;
  const thread = open
    ? `<div class="moment-thread">
        <div class="moment-comment-list">${momentCommentsHtml(moment)}</div>
        ${chatComposerHtml(`moment-comment-${moment.id}`, { max: 280, placeholder: "Add a comment…", extraClass: "watch-composer moment-composer" })}
        <button class="text-btn" type="button" data-act="moment-comments" data-id="${moment.id}">Hide comments</button>
      </div>`
    : "";
  return `<article class="polaroid">
      <img alt="" src="${momentSrc(moment.id)}">
      <p>${esc(moment.caption || "A moment")}</p>
      <div class="who">${esc(whoName(moment.authorId))}</div>
      <div class="moment-social">
        <div class="moment-react-row">${reacts}</div>
        ${summary ? `<p class="moment-react-summary">${esc(summary)}</p>` : ""}
        ${commentBtn}
        <button class="text-btn" type="button" data-act="favorite" data-type="moment" data-id="${moment.id}" data-label="${esc((moment.caption || "A moment").slice(0, 40).replace(/"/g, ""))}">★ Favorite</button>
      </div>
      ${thread}
      ${moment.authorId === S.user.id ? `<button class="text-btn" type="button" data-act="delete-moment" data-id="${moment.id}">Remove</button>` : ""}
    </article>`;
}

function momentsHtml() {
  if (!S.moments.length) return `<div class="empty empty-illo">${mascotHtml("wait")}<p>No moments yet. Share a photo they'll smile at later.</p></div>`;
  return S.moments.map((moment) => momentCardHtml(moment)).join("");
}

function paintMomentGrid() {
  const grid = document.getElementById("moment-grid");
  if (grid) grid.innerHTML = momentsHtml();
  const openList = document.querySelector(".moment-comment-list");
  if (openList) openList.scrollTop = openList.scrollHeight;
}

async function loadMomentComments(momentId) {
  const data = await api("moment_comments", { query: { moment: momentId } });
  S.momentComments[momentId] = data.comments || [];
  paintMomentGrid();
}

async function momentReact(momentId, emoji) {
  const moment = S.moments.find((row) => row.id === momentId);
  if (!moment) return;
  const next = moment.myReaction === emoji ? "" : emoji;
  const data = await api("moment_react", { method: "POST", json: { momentId, emoji: next } });
  moment.reactionCounts = data.reactionCounts || {};
  moment.myReaction = data.myReaction || null;
  moment.commentCount = data.commentCount ?? moment.commentCount;
  paintMomentGrid();
}

function momentsScreen() {
  return `${errorHtml()}${flashHtml()}${screenBar("Photos for later", "Moments")}
    <form data-form="moment" class="stack">
      <input name="photo" type="file" accept="image/*" required>
      <input name="caption" maxlength="300" placeholder="Caption (optional)">
      <button class="btn rose" type="submit">Share</button>
    </form>
    <div id="moment-grid" class="moment-grid gap-top">${momentsHtml()}</div>`;
}

function gameStatus(game) {
  if (game.type === "tictactoe") {
    if (game.winner === "draw") return "Draw. A gentle tie.";
    if (game.winner) return game.winner === game.youAre ? "You won." : `${partnerName()} won.`;
    return game.yourTurn ? "Your turn." : `Waiting for ${partnerName()}.`;
  }
  if (game.type === "solitaire") {
    if (game.you.won) return "You cleared the deck!";
    const p = game.partner;
    const partnerLine = p.won ? `${partnerName()} already won their board.` : `${partnerName()}: ${p.foundationCards} on foundations, ${p.stockLeft} cards left.`;
    return partnerLine;
  }
  if (game.type === "connect4") {
    if (game.winner === "draw") return "Board full — it's a draw.";
    if (game.winner) return game.winner === game.youAre ? "You connected four!" : `${partnerName()} won.`;
    return game.yourTurn ? "Your turn — pick a column." : `Waiting for ${partnerName()}.`;
  }
  if (game.type === "memory") {
    if (game.winner === "draw") return "It's a tie!";
    if (game.winner) return String(game.winner) === String(S.user.id) ? "You matched the most!" : `${partnerName()} won.`;
    return game.yourTurn ? "Flip two cards." : `Waiting for ${partnerName()}.`;
  }
  if (game.type === "hangman") {
    if (game.winner === "guesser") return game.youAre === "guesser" ? "You guessed it!" : `${partnerName()} guessed your word.`;
    if (game.winner === "setter") return game.youAre === "setter" ? "They ran out of guesses!" : "Out of guesses.";
    return game.yourTurn ? "Your move." : `Waiting for ${partnerName()}.`;
  }
  if (game.type === "kahoot") {
    if (game.phase === "build") return game.youAreHost ? "You are hosting. Add questions, then start." : `Waiting for ${partnerName()} to start the quiz.`;
    if (game.phase === "done") return "Quiz complete. Play again?";
    if (game.phase === "reveal") return "Answers revealed.";
    if (game.answered) return `Waiting for ${partnerName()}…`;
    return "Pick an answer.";
  }
  if (game.winner) return game.winner === game.youAre ? "You won." : `${partnerName()} won.`;
  if (game.mustFrom && game.yourTurn) return "Jump again.";
  return game.yourTurn ? "Your turn." : `Waiting for ${partnerName()}.`;
}

const SOL_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SOL_SUITS = ["♠", "♥", "♦", "♣"];

function solIsRed(card) {
  const suit = Math.floor(card / 13);
  return suit === 1 || suit === 2;
}

function solCardLabel(card) {
  return `${SOL_RANKS[card % 13]}${SOL_SUITS[Math.floor(card / 13)]}`;
}

function solCardHtml(card, extra = "") {
  const red = solIsRed(card);
  return `<span class="sol-card ${red ? "red" : "black"} ${extra}">${esc(solCardLabel(card))}</span>`;
}

function solitaireInner(game) {
  const you = game.you;
  const wasteTop = you.waste.length ? you.waste[you.waste.length - 1] : null;
  const foundations = you.foundations.map((pile, fi) => {
    const top = pile.length ? pile[pile.length - 1] : null;
    return `<button class="sol-pile foundation" type="button" data-act="sol-foundation" data-pile="${fi}">${top ? solCardHtml(top) : "<i class='sol-slot'>A</i>"}</button>`;
  }).join("");
  const tableau = you.tableau.map((col, pi) => {
    const cards = col.map((cell, ci) => {
      if (!cell.up) return `<span class="sol-card back"></span>`;
      const sel = S.solSel && S.solSel.pile === pi && S.solSel.at === ci ? "sel" : "";
      return `<button class="sol-card-btn ${sel}" type="button" data-act="sol-pick" data-pile="${pi}" data-at="${ci}">${solCardHtml(cell.c)}</button>`;
    }).join("");
    return `<button class="sol-col" type="button" data-act="sol-col" data-pile="${pi}">${cards || "<span class='sol-empty'></span>"}</button>`;
  }).join("");
  return wrapGameBody(`<p>${esc(gameStatus(game))}</p>
    <p class="empty">Your own Klondike board. ${you.moves} moves.</p>
    <div class="sol-board">
      <div class="sol-top">
        <button class="sol-pile stock" type="button" data-act="sol-draw" title="Draw"><span class="sol-stock">${you.stock ? you.stock : "↻"}</span></button>
        <div class="sol-pile waste">${wasteTop ? solCardHtml(wasteTop) : "<span class='sol-slot'>—</span>"}</div>
        <div class="sol-foundations">${foundations}</div>
      </div>
      <div class="sol-tableau">${tableau}</div>
      <div class="row gap-top">
        <button class="btn ghost" type="button" data-act="sol-waste-foundation" ${wasteTop ? "" : "disabled"}>Waste → foundation</button>
      </div>
    </div>
    <div class="row gap-top"><button class="btn ghost" type="button" data-act="reset-game">New deal</button></div>`, game);
}

function kahootScoresHtml(game) {
  return game.scores.map((row) => {
    const name = row.userId === S.user.id ? "You" : partnerName();
    return `<span class="kahoot-score"><strong>${esc(name)}</strong> ${row.points}</span>`;
  }).join(" · ");
}

function kahootInner(game) {
  const scores = `<p class="kahoot-scores">${kahootScoresHtml(game)}</p>`;
  if (game.phase === "build") {
    const list = game.buildQuestions.map((q, i) => `<li><strong>${esc(q.prompt)}</strong><br><span class="empty">${esc(q.choices[q.correct])}</span></li>`).join("");
    const packs = (game.packs || []).map((id) => `<button class="btn soft" type="button" data-act="kahoot-pack" data-pack="${id}">${esc(id)}</button>`).join(" ");
    const host = game.youAreHost
      ? `<form data-form="kahoot-add" class="stack">
          <div class="field"><label>Question</label><input name="prompt" maxlength="220" required></div>
          <div class="field"><label>Answer A</label><input name="c0" maxlength="90" required></div>
          <div class="field"><label>Answer B</label><input name="c1" maxlength="90" required></div>
          <div class="field"><label>Answer C</label><input name="c2" maxlength="90" required></div>
          <div class="field"><label>Answer D</label><input name="c3" maxlength="90" required></div>
          <div class="field"><label>Correct answer</label>
            <select name="correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select>
          </div>
          <button class="btn rose" type="submit">Add question</button>
        </form>
        <div class="row gap-top">${packs}<button class="btn ghost" type="button" data-act="kahoot-clear">Clear</button></div>
        <button class="btn rose gap-top" type="button" data-act="kahoot-start" ${game.questionCount ? "" : "disabled"}>Start quiz (${game.questionCount})</button>`
      : `<p class="empty">The host is building the quiz. Hang tight.</p>`;
    return wrapGameBody(`<p>${esc(gameStatus(game))}</p>
      ${scores}
      <ol class="kahoot-list">${list || "<li class='empty'>No questions yet.</li>"}</ol>
      ${host}
      <div class="row gap-top"><button class="btn ghost" type="button" data-act="reset-game">Reset quiz</button></div>`, game);
  }
  if (game.phase === "done") {
    return wrapGameBody(`<p>${esc(gameStatus(game))}</p>
      ${scores}`, game);
  }
  const q = game.currentQuestion;
  const colors = ["kahoot-a", "kahoot-b", "kahoot-c", "kahoot-d"];
  const choices = q ? q.choices.map((text, i) => {
    const reveal = game.phase === "reveal";
    const correct = reveal && q.correct === i;
    const yours = game.yourChoice === i;
    const disabled = game.phase !== "question" || game.answered;
    return `<button class="kahoot-choice ${colors[i]} ${correct ? "correct" : ""} ${yours ? "yours" : ""}" type="button" data-act="kahoot-answer" data-choice="${i}" ${disabled ? "disabled" : ""}>${esc(text)}</button>`;
  }).join("") : "";
  let reveal = "";
  if (game.phase === "reveal" && game.reveal) {
    const pts = game.reveal.points[String(S.user.id)] || 0;
    reveal = `<p class="flash">${pts ? `+${pts} points` : "No points this time."}</p>`;
    if (game.youAreHost) reveal += `<button class="btn rose" type="button" data-act="kahoot-next">Next</button>`;
  }
  return wrapGameBody(`<p>${esc(gameStatus(game))}</p>
    ${scores}
    <p class="kahoot-q">${q ? esc(q.prompt) : ""}</p>
    <p class="empty">Question ${game.current + 1} of ${game.questionCount}</p>
    <div class="kahoot-grid">${choices}</div>
    ${reveal}`, game);
}

function pieceHtml(piece) {
  if (!piece) return "";
  const side = piece === "r" || piece === "R" ? "red" : "black";
  const king = piece === "R" || piece === "B" ? " king" : "";
  return `<i class="piece ${side}${king}"></i>`;
}

function gameInner() {
  const game = S.game;
  if (!game) return "";
  let board;
  if (game.type === "solitaire") return solitaireInner(game);
  if (game.type === "kahoot") return kahootInner(game);
  if (game.type === "connect4") {
    const cols = Array.from({ length: 7 }, (_, c) => `<button class="btn ghost c4-col" type="button" data-act="c4-drop" data-col="${c}" ${game.yourTurn && !game.winner ? "" : "disabled"}">↓</button>`).join("");
    const cells = game.board.map((row) => row.map((cell) => {
      const cls = cell === "red" ? "piece red" : cell === "black" ? "piece black" : "";
      return `<div class="c4-slot">${cls ? `<span class="${cls}"></span>` : ""}</div>`;
    }).join("")).join("");
    return wrapGameBody(`<p>${esc(gameStatus(game))} You are ${game.youAre}.</p>
      <div class="c4-cols">${cols}</div><div class="c4-board">${cells}</div>`, game);
  }
  if (game.type === "memory") {
    const cards = game.cards.map((card, index) => {
      const show = card.matched || card.up;
      const label = show ? card.v : "";
      const open = game.yourTurn && !game.winner && !card.matched && !card.up;
      return `<button class="memory-card" type="button" data-act="memory-flip" data-i="${index}" ${open ? "" : "disabled"}>${label}</button>`;
    }).join("");
    return wrapGameBody(`<p>${esc(gameStatus(game))}</p>
      <div class="memory-grid">${cards}</div>`, game);
  }
  if (game.type === "hangman") {
    let play = "";
    if (game.phase === "word" && game.youAre === "setter") {
      play = `<form data-form="hangman-word" class="stack"><input name="word" maxlength="12" placeholder="Secret word" required><button class="btn rose" type="submit">Set word</button></form>`;
    } else if (game.phase === "guess" && game.youAre === "guesser") {
      const letters = "abcdefghijklmnopqrstuvwxyz".split("").map((ch) => {
        const used = game.guessed.includes(ch);
        return `<button class="btn ghost hang-letter" type="button" data-act="hangman-guess" data-letter="${ch}" ${used || game.winner ? "disabled" : ""}>${ch}</button>`;
      }).join("");
      play = `<p class="hang-mask">${esc(game.mask || "")}</p><p>Wrong: ${game.wrong}/6</p><div class="hang-letters">${letters}</div>`;
    } else {
      play = `<p class="hang-mask">${esc(game.mask || "····")}</p><p class="empty">Waiting for ${esc(partnerName())}…</p>`;
    }
    return wrapGameBody(`<p>${esc(gameStatus(game))} You are the ${game.youAre}.</p>${play}
      ${game.word ? `<p>Word was: <strong>${esc(game.word)}</strong></p>` : ""}`, game);
  }
  if (game.type === "tictactoe") {
    board = `<div class="ttt">${game.board.map((value, index) => {
      const open = game.yourTurn && game.legal.includes(index);
      const cls = value === "X" ? "x" : "";
      return `<button class="cell ${cls}" type="button" data-act="ttt" data-i="${index}" ${open ? "" : "disabled"}>${esc(value || "")}</button>`;
    }).join("")}</div>`;
  } else if (game.type === "checkers") {
    const rows = game.youAre === "red" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = game.youAre === "red" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cells = [];
    rows.forEach((row) => {
      cols.forEach((col) => {
        const play = (row + col) % 2 === 1;
        if (!play) {
          cells.push(`<div class="sq pale"></div>`);
          return;
        }
        const selected = S.selected && S.selected[0] === row && S.selected[1] === col;
        const last = game.lastMove && (
          (game.lastMove.to[0] === row && game.lastMove.to[1] === col) ||
          (game.lastMove.from[0] === row && game.lastMove.from[1] === col)
        );
        const dest = S.selected && (game.legal || []).some((move) => move.from[0] === S.selected[0] && move.from[1] === S.selected[1] && move.to[0] === row && move.to[1] === col);
        cells.push(`<button class="sq play ${selected ? "sel" : ""} ${last ? "last" : ""}" type="button" data-act="pick" data-r="${row}" data-c="${col}">${pieceHtml(game.board[row][col])}${dest ? `<i class="dot"></i>` : ""}</button>`);
      });
    });
    const side = game.youAre === "red" ? "You play coral." : "You play ink.";
    board = `<p class="empty">${side} Jumps are required, and a second jump continues your turn.</p><div class="checkers">${cells.join("")}</div>`;
  }
  const title = game.type === "tictactoe" ? "Tic-tac-toe" : "Checkers";
  const label = game.type === "tictactoe" ? `You are ${game.youAre}.` : "";
  return wrapGameBody(`<p>${esc(gameStatus(game))} ${esc(label)}</p>
    ${board}`, game);
}

function gamesScreen() {
  if (!S.gameType || !S.game) {
    const actLink = (route, title, desc) => `<button class="game-card" type="button" data-act="go" data-route="${route}" data-back-games="1"><h3>${esc(title)}</h3><p>${esc(desc)}</p></button>`;
    return `${errorHtml()}${screenBar("Pick a board", "Games")}
      <div class="game-list">
        ${gameLobbyCard("tictactoe", "Tic-tac-toe", "Three in a row. The person who opened the bubble goes first.")}
        ${gameLobbyCard("checkers", "Checkers", "Coral moves first. If you can jump, you have to. Kings wear a gold ring.")}
        ${gameLobbyCard("solitaire", "Solitaire", "Your own Klondike board in the bubble. Race to clear the deck.")}
        ${gameLobbyCard("kahoot", "Kahoot", "Build a quiz together, then answer in sync for points.")}
        ${actLink("daily", "Daily question", "One question a day — answers unlock together.")}
        ${actLink("wyr", "Would you rather", "Quick rounds to see if you match.")}
        ${actLink("mood", "Mood check-in", "Share how you feel today.")}
        ${gameLobbyCard("connect4", "Connect Four", "Drop discs — four in a row wins.")}
        ${gameLobbyCard("memory", "Memory match", "Find the pairs together.")}
        ${gameLobbyCard("hangman", "Hangman", "One sets the word, one guesses.")}
      </div>`;
  }
  const title = gameTypeLabel(S.game.type);
  return `<div class="pane-game ${S.gameChatOpen ? "chat-open" : ""}">
    ${errorHtml()}${gameBarHtml(title)}${gameLeaveOverlayHtml()}
    <div class="game-layout"><div id="game-root" class="game-main">${gameInner()}</div>${gameChatAside()}</div>
  </div>`;
}

function watchCommentsHtml() {
  const vid = S.watch?.videoId;
  if (!vid) {
    return `<p class="empty">Start a video to open the side chat for that show.</p>`;
  }
  if (!S.watchComments.length) {
    return `<p class="empty">No comments yet. React while you watch.</p>`;
  }
  return S.watchComments.map((comment) => {
    const mine = comment.senderId === S.user.id;
    return `<div class="watch-msg ${mine ? "mine" : "theirs"}"><strong>${esc(whoName(comment.senderId))}</strong>${formatChatBody(comment.body)}<time>${esc(clock(comment.createdAt))}</time></div>`;
  }).join("");
}

function watchScreen() {
  const vid = S.watch?.videoId;
  const chatOpen = S.watchChatOpen !== false;
  return `<div class="pane-watch ${chatOpen ? "chat-open" : "chat-collapsed"}">
    ${errorHtml()}${flashHtml()}${screenBar("Press play for two", "Watch together")}
    <p class="empty">Paste a YouTube link you both want to watch. Playback stays roughly in step. Comments on the right stay tied to this video.</p>
    <button class="btn ghost watch-chat-toggle" type="button" data-act="watch-chat-toggle">${chatOpen ? "Hide chat" : "Show chat"}</button>
    <div class="watch-layout">
      <div class="watch-main">
        <form data-form="watch" class="stack">
          <input name="url" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off">
          <button class="btn rose" type="submit">Watch this</button>
        </form>
        <div class="player-frame"><div id="player"></div></div>
      </div>
      <aside class="watch-chat card">
        <h3>Video chat</h3>
        <p class="empty watch-chat-hint">${vid ? "Comments for this video only." : "Pick a video to chat here."}</p>
        <div id="watch-msgs" class="watch-msgs">${watchCommentsHtml()}</div>
        ${chatComposerHtml("watch-chat", { max: 280, placeholder: "Say something…", disabled: !vid, extraClass: "watch-composer" })}
      </aside>
    </div>
  </div>`;
}

function callActionsHtml() {
  if (!Call.active) return `<button class="btn rose" type="button" data-act="start-call">Start video call</button>`;
  return `<button class="btn danger" type="button" data-act="hangup">Hang up</button>
    <button class="btn ghost" type="button" data-act="mute">${S.micOff ? "Unmute" : "Mute"}</button>
    <button class="btn ghost" type="button" data-act="camera">${S.camOff ? "Camera on" : "Camera off"}</button>`;
}

function callScreen() {
  return `${errorHtml()}${screenBar(`See ${partnerName()}`, "Video call")}
    <p class="empty">Stay on this page while you talk, with BuzzBuds open on both sides. Calls work well here on localhost. A public version later needs HTTPS.</p>
    <div class="call-stage">
      <video id="remote-video" class="remote" autoplay playsinline></video>
      <video id="local-video" class="local" autoplay playsinline muted></video>
    </div>
    <p id="call-status">${esc(S.callStatus || "Camera stays off until you start.")}</p>
    <div id="call-actions" class="call-actions">${callActionsHtml()}</div>`;
}

function moreScreen() {
  return `${screenBar("The rest of the bubble", "More")}
    <div class="game-list">
      <button class="game-card" type="button" data-act="go" data-route="playlist" data-back-more="1"><h3>Playlist</h3><p>Shared songs and live reactions.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="draw" data-back-more="1"><h3>Drawing board</h3><p>Doodle together in real time.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="calendar" data-back-more="1"><h3>Calendar</h3><p>Dates, calls, and anniversaries.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="favorites" data-back-more="1"><h3>Favorites</h3><p>Jump to saved moments and notes.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="watch" data-back-more="1"><h3>Watch</h3><p>A YouTube video, in step.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="call" data-back-more="1"><h3>Video call</h3><p>See and hear each other.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="look" data-back-more="1"><h3>Look</h3><p>Theme, animations, and layout.</p></button>
      <button class="game-card" type="button" data-act="go" data-route="profile" data-back-more="1"><h3>Profile</h3><p>Your name, username, and the door out.</p></button>
    </div>`;
}

function profileScreen() {
  const bubble = S.bubble && S.bubble.status === "active"
    ? `<div class="card gap-top">
        <h3>This bubble</h3>
        <p>You and ${esc(partnerName())} (@${esc(S.bubble.partner.username)}). Leaving closes only this bubble.</p>
        ${S.askLeave
          ? `<button class="btn danger" type="button" data-act="leave">Yes, leave the bubble</button>`
          : `<button class="btn danger" type="button" data-act="ask-leave">Leave bubble</button>`}
      </div>`
    : "";
  return `${errorHtml()}${flashHtml()}
    <p class="eyebrow">Profile</p>
    <h2>${esc(S.user.displayName)}</h2>
    <p class="empty">${esc(S.user.email)}</p>
    <p><button class="text-btn" type="button" data-act="go" data-route="look">Theme and layout</button></p>
    <form data-form="profile" class="stack">
      <div class="field"><label for="displayName">Name</label><input id="displayName" name="displayName" maxlength="40" value="${esc(S.user.displayName)}" required></div>
      <div class="field"><label for="username">Username</label><input id="username" name="username" maxlength="20" autocapitalize="none" value="${esc(S.user.username)}" required></div>
      <button class="btn rose" type="submit">Save profile</button>
    </form>
    ${bubble}
    <p class="gap-top"><button class="text-btn" type="button" data-act="logout">Sign out</button></p>`;
}

function choiceGroup(title, hint, key, options) {
  const look = currentLook();
  const buttons = options.map(([value, label]) => `<button class="choice ${look[key] === value ? "on" : ""}" type="button" data-act="look" data-key="${key}" data-value="${value}">${label}</button>`).join("");
  return `<section class="look-block"><h3>${title}</h3><p class="empty">${hint}</p><div class="choice-grid">${buttons}</div></section>`;
}

function presetChoices() {
  const look = currentLook();
  const presets = Object.entries(PRESETS).map(([id, preset]) => {
    const tone = preset.light;
    return `<button class="choice ${look.preset === id ? "on" : ""}" type="button" data-act="look" data-key="preset" data-value="${id}"><span class="chip" style="background:linear-gradient(120deg, ${tone.bg} 0 42%, ${tone.accent} 42% 68%, ${tone.ink} 68%)"></span>${preset.label}</button>`;
  }).join("");
  const customBg = look.bg || "#f6f1ec";
  const customAccent = look.accent || "#F55F73";
  const custom = `<button class="choice ${look.preset === "custom" ? "on" : ""}" type="button" data-act="look" data-key="preset" data-value="custom"><span class="chip" style="background:linear-gradient(120deg, ${customBg} 0 55%, ${customAccent} 55%)"></span>Custom</button>`;
  return `<section class="look-block"><h3>Theme</h3><p class="empty">Pick a palette. Custom uses the colors below.</p><div class="choice-grid">${presets}${custom}</div></section>`;
}

function lookScreen() {
  const look = currentLook();
  const tokens = tokensFor(look);
  return `${errorHtml()}
    <p class="eyebrow">Your look</p>
    <h2>Theme and layout</h2>
    <p>This stays on your account, in every bubble. Their screen keeps their own look.</p>
    ${presetChoices()}
    ${choiceGroup("Mode", "Light and dark recolor the palette you picked.", "mode", [["light", "Light"], ["dark", "Dark"]])}
    <section class="look-block">
      <h3>Colors</h3>
      <p class="empty">Accent tints buttons and your messages. Background is used when Custom is selected.</p>
      <div class="color-row">
        <div class="field"><label for="look-accent">Accent</label><input id="look-accent" type="color" data-look-color="accent" value="${esc(look.accent || tokens["--rose"])}"></div>
        <div class="field"><label for="look-bg">Background</label><input id="look-bg" type="color" data-look-color="bg" value="${esc(look.bg || tokens["--bg"])}"></div>
        <button class="btn ghost" type="button" data-act="look" data-key="accent" data-value="none">Preset accent</button>
      </div>
    </section>
    ${choiceGroup("Density", "How much room each screen takes.", "density", [["cozy", "Cozy"], ["compact", "Compact"]])}
    ${choiceGroup("Navigation", "A side menu, or a bar across the top. Phones keep the bottom tabs.", "nav", [["side", "Side"], ["top", "Top"]])}
    ${choiceGroup("Home", "The shortcuts on Home.", "home", [["grid", "Grid"], ["stack", "Stack"]])}
    ${choiceGroup("Corners", "Round, softened, or square.", "corners", [["round", "Round"], ["soft", "Soft"], ["sharp", "Sharp"]])}
    ${choiceGroup("Width", "A focused column, or more room on a wide screen.", "span", [["focus", "Focus"], ["wide", "Wide"]])}
    ${choiceGroup("Notes", "A little tilt, or a straight board.", "notes", [["tilted", "Tilted"], ["flat", "Flat"]])}
    ${choiceGroup("Animations", "Hearts, transitions, and little celebrations.", "animations", [["on", "On"], ["off", "Off"]])}
    ${notifyPrefsSection()}`;
}

function notifyPrefsSection() {
  const notify = S.activity?.notify || {};
  const rows = [
    ["chat", "Chat messages"],
    ["games", "Games & turns"],
    ["daily", "Daily question"],
    ["jar", "Love jar"],
  ];
  const buttons = rows.map(([key, label]) => {
    const muted = notify[key]?.mute;
    return `<button class="choice ${muted ? "on" : ""}" type="button" data-act="notify-toggle" data-key="${key}">${label} — ${muted ? "Muted" : "Sound on"}</button>`;
  }).join("");
  return `<section class="look-block"><h3>Activity alerts</h3><p class="empty">Per-bubble notification style (saved in your shared hub).</p><div class="choice-grid">${buttons}</div></section>`;
}

function screenFor(route) {
  if (route === "search") return typeof BuzzActivities !== "undefined" ? BuzzActivities.screens.search(S.searchResults) : "";
  if (ACTIVITY_KEYS.has(route) || route === "calendar" || route === "favorites") return activityScreen(route);
  const map = {
    home: homeScreen,
    chat: chatScreen,
    notes: notesScreen,
    moments: momentsScreen,
    watch: watchScreen,
    games: gamesScreen,
    call: callScreen,
    profile: profileScreen,
    look: lookScreen,
    more: moreScreen,
  };
  return (map[route] || homeScreen)();
}

function simpleFrame(content) {
  return `<div class="simple">
    <header class="simple-bar">
      <button class="brand text-btn" type="button" data-act="go" data-route="bubbles">${mark()}</button>
      <div class="row">
        <button class="text-btn" type="button" data-act="go" data-route="look">Look</button>
        <button class="text-btn" type="button" data-act="go" data-route="profile">Profile</button>
        <button class="text-btn" type="button" data-act="logout">Sign out</button>
      </div>
    </header>
    <div id="screen">${content}</div>
  </div>`;
}

function peopleNav() {
  const active = (S.bubbles || []).filter((bubble) => bubble.status === "active");
  return `<div class="people">${active.map((bubble) => `<button class="person ${bubble.id === S.bubble?.id ? "on" : ""}" type="button" data-act="open-bubble" data-id="${bubble.id}">${ava(bubble.partner.displayName)}<span>${esc(bubble.partner.displayName)}</span></button>`).join("")}
    <button class="person add" type="button" data-act="go" data-route="bubbles"><span class="ava">+</span><span>New bubble</span></button></div>`;
}

function appShell(content) {
  const items = [
    ["bubbles", "Bubbles", "bubbles"],
    ["home", "Home", "home"],
    ["chat", "Chat", "chat"],
    ["notes", "Notes", "note"],
    ["moments", "Moments", "photo"],
    ["watch", "Watch", "play"],
    ["games", "Games", "grid"],
    ["call", "Call", "video"],
    ["look", "Look", "look"],
    ["profile", "Profile", "user"],
  ];
  const tabs = [
    ["bubbles", "Bubbles", "bubbles"],
    ["home", "Home", "home"],
    ["chat", "Chat", "chat"],
    ["notes", "Notes", "note"],
    ["more", "More", "more"],
  ];
  return `<div class="shell ${S.sidebarCollapsed ? "nav-collapsed" : ""}">
    <aside class="sidebar">
      <div class="side-head">
        <button class="brand text-btn" type="button" data-act="go" data-route="home">${mark()}</button>
        <button class="nav-collapse" type="button" data-act="nav-collapse" aria-label="${S.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}">${S.sidebarCollapsed ? "»" : "«"}</button>
      </div>
      ${peopleNav()}
      <nav class="side-nav">
        ${items.map(([route, label, ic]) => navButtonHtml(route, label, ic)).join("")}
      </nav>
      <div class="you-chip ${S.presence?.partnerOnline ? "partner-here" : ""}">${ava(partnerName())}<div><strong>${esc(partnerName())}</strong><small>@${esc(S.bubble.partner.username)}</small></div></div>
    </aside>
    <div class="workspace">
      <main class="main"><div id="screen" class="${S.route === "chat" ? "is-chat" : S.route === "watch" ? "is-watch" : S.route === "games" && S.gameType ? "is-game" : ""}">${content}</div></main>
      ${S.route === "home" ? todayRailHtml() : ""}
    </div>
    <nav class="tabbar">
      ${tabs.map(([route, label, ic]) => tabButtonHtml(route, label, ic)).join("")}
    </nav>
  </div>`;
}

function destroyPlayer() {
  if (!S.player) return;
  try {
    if (typeof S.player.destroy === "function") S.player.destroy();
  } catch {
    /* iframe already gone */
  }
  S.player = null;
}

function render() {
  destroyPlayer();
  applyLook();
  const titles = {
    landing: "BuzzBuds — a private bubble for two",
    auth: "Sign in · BuzzBuds",
    bubbles: "Bubbles · BuzzBuds",
    home: "Home · BuzzBuds",
    chat: "Chat · BuzzBuds",
    notes: "Notes · BuzzBuds",
    moments: "Moments · BuzzBuds",
    watch: "Watch · BuzzBuds",
    games: "Games · BuzzBuds",
    call: "Call · BuzzBuds",
    profile: "Profile · BuzzBuds",
    look: "Look · BuzzBuds",
    more: "More · BuzzBuds",
    daily: "Daily question · BuzzBuds",
    mood: "Mood · BuzzBuds",
    timeline: "Timeline · BuzzBuds",
    playlist: "Playlist · BuzzBuds",
    draw: "Draw · BuzzBuds",
    wyr: "Quick match · BuzzBuds",
    bucket: "Bucket list · BuzzBuds",
    calendar: "Calendar · BuzzBuds",
    favorites: "Favorites · BuzzBuds",
    quiz: "Couple quiz · BuzzBuds",
    scrapbook: "Scrapbook · BuzzBuds",
    jar: "Love jar · BuzzBuds",
    search: "Search · BuzzBuds",
  };
  document.title = titles[S.route] || "BuzzBuds";
  let html;
  const inside = S.bubble && S.bubble.status === "active";
  if (!S.user) html = S.route === "auth" ? authScreen() : landingScreen();
  else if (!inside) html = simpleFrame(S.route === "profile" ? profileScreen() : S.route === "look" ? lookScreen() : bubblesScreen());
  else html = appShell(S.route === "bubbles" ? bubblesScreen() : screenFor(S.route));
  paintView(html);
}

function afterRender() {
  if (S.route === "auth") {
    syncAuthSubmitState();
    if (S.resetStep === "verify") {
      wireResetCodeBoxes();
      startResetTicker();
    }
  }
  const list = document.getElementById("msgs");
  if (list) list.scrollTop = list.scrollHeight;
  const watchList = document.getElementById("watch-msgs");
  if (watchList) watchList.scrollTop = watchList.scrollHeight;
  if (S.route === "watch") {
    setupWatch();
    pullWatchComments().catch(() => {});
  }
  if (S.route === "games" && S.gameType) {
    pullGameComments().catch(() => {});
    const gameList = document.getElementById("game-msgs");
    if (gameList) gameList.scrollTop = gameList.scrollHeight;
  }
  if (S.route === "call") attachCallMedia();
  if (S.route === "notes") markSectionSeen("notes");
  if (S.route === "chat") markSectionSeen("chat");
  if (S.route === "moments") markSectionSeen("moments");
  if (S.route === "watch") markSectionSeen("watch");
  paintBadges();
  const chatInput = document.querySelector('form[data-form="chat"] [name="body"]');
  if (chatInput && !chatInput.dataset.typingBound) {
    chatInput.dataset.typingBound = "1";
    chatInput.addEventListener("input", pingTyping);
  }
  document.querySelectorAll(".composer textarea").forEach(growComposer);
  syncViewportHeight();
  scrollChatToEnd();
  if (S.route === "home") hydrateTodayRail().catch(() => {});
  if (!S.visitClock) {
    S.visitClock = window.setInterval(() => {
      const text = visitCountdownLive(S.bubble?.nextVisitAt);
      document.querySelectorAll("#visit-countdown, #visit-countdown-rail").forEach((el) => { el.textContent = text; });
    }, 30000);
  }
  pullPresence().catch(() => {});
  if (ACTIVITY_KEYS.has(S.route) || S.route === "calendar" || S.route === "favorites") {
    paintActivityComments();
    if (S.route === "draw") setupDrawCanvas();
    S.activityKey = S.route === "calendar" || S.route === "favorites" ? "hub" : S.route;
    markActivitySeen();
  }
}

async function tick() {
  if (!S.user || S.ticking || S.navLock) return;
  S.ticking = true;
  try {
    const before = bubblesSig();
    const hadBubble = !!(S.bubble && S.bubble.status === "active");
    await refreshState();
    if (hadBubble && (!S.bubble || S.bubble.status !== "active") && !["bubbles", "profile"].includes(S.route)) {
      await go("bubbles", { force: true });
      return;
    }
    if (S.bubble && S.bubble.status === "active") {
      if (S.route === "chat") await pullChat();
      if (S.route === "notes") await pullNotes();
      if (S.route === "moments") await pullMoments();
      if (S.gameType) {
        await pullGame();
        if (S.route === "games") await pullGameComments();
      } else {
        await pullGamesTurnPing();
      }
      if (S.route === "watch") {
        await pullWatch();
        await pullWatchComments();
      }
      if (ACTIVITY_KEYS.has(S.route) || S.route === "calendar" || S.route === "favorites") {
        await pullActivityState();
      }
    }
    await pullSignals();
    await pullPresence();
    if (bubblesSig() !== before) {
      const list = document.getElementById("bubble-list");
      if (list) list.innerHTML = bubbleListHtml();
      const people = document.querySelector(".people");
      if (people) people.outerHTML = peopleNav();
    }
  } catch {
    /* keep the page usable if one poll fails */
  } finally {
    S.ticking = false;
  }
}

async function pullChat() {
  const since = S.chat.length ? S.chat[S.chat.length - 1].id : 0;
  const data = await api("messages", { query: { since } });
  if (!data.messages.length) return;
  if (since === 0) S.chat = data.messages;
  else S.chat.push(...data.messages);
  const list = document.getElementById("msgs");
  if (!list) return;
  const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  if (since === 0) {
    list.innerHTML = msgsHtml(S.chat);
  } else {
    data.messages.forEach((message) => appendChatMessage(message));
  }
  if (stick) list.scrollTop = list.scrollHeight;
}

async function pullNotes() {
  const data = await api("notes");
  const sig = data.notes.map((note) => note.id).join(",");
  if (sig === S.notesSig) return;
  S.notes = data.notes;
  S.notesSig = sig;
  const grid = document.getElementById("note-grid");
  if (grid) grid.innerHTML = notesHtml();
}

async function pullMoments() {
  const data = await api("moments");
  const sig = data.moments.map((moment) => `${moment.id}:${moment.commentCount}:${JSON.stringify(moment.reactionCounts)}:${moment.myReaction || ""}`).join("|");
  const reactSig = momentReactSig(data.moments);
  if (sig === S.momentsSig) return;
  if (S.momentsReactSig && reactSig !== S.momentsReactSig && typeof BuzzMotion !== "undefined") {
    BuzzMotion.heartBurst(6);
  }
  S.moments = data.moments;
  S.momentsSig = sig;
  S.momentsReactSig = reactSig;
  paintMomentGrid();
  if (S.momentOpen) loadMomentComments(S.momentOpen).catch(() => {});
}

async function pullGamesTurnPing() {
  if (!S.bubble || S.bubble.status !== "active" || S.gameType) return;
  try {
    const data = await api("games_list");
    const rows = data.games || [];
    const sig = rows.map((r) => `${r.type}:${r.yourTurn ? 1 : 0}`).join(",");
    if (S.gamesTurnSig && sig !== S.gamesTurnSig) {
      rows.forEach((r) => {
        if (r.yourTurn && !S.gamesTurnSig.includes(`${r.type}:1`)) {
          if (!hubNotifyMuted("games")) playTurnRing();
          if (S.route !== "games" || S.gameType !== r.type) {
            showFlash(`Your turn in ${gameTypeLabel(r.type)}.`);
          }
        }
      });
    }
    S.gamesTurnSig = sig;
    if (S.route === "games" && !S.gameType) S.gamesLobby = rows;
  } catch {
    /* ignore */
  }
}

async function pullGame() {
  if (!S.gameType) return;
  const data = await api("game", { query: { type: S.gameType } });
  const next = data.game;
  const changed = !S.game || gameStateSig(S.game) !== gameStateSig(next);
  if (changed) {
    S.game = next;
    S.selected = next.mustFrom || null;
    paintGame();
  }
  checkTurnNotify(next);
}

function paintGameComments() {
  const list = document.getElementById("game-msgs");
  if (!list) return;
  const sig = S.gameComments.map((c) => c.id).join(",");
  if (sig === S.gameCommentsSig && S.gameCommentsType === S.gameType) return;
  S.gameCommentsSig = sig;
  S.gameCommentsType = S.gameType || "";
  list.innerHTML = gameCommentsHtml();
  list.scrollTop = list.scrollHeight;
}

function paintGame() {
  const root = document.getElementById("game-root");
  if (root) root.innerHTML = gameInner();
  paintGameComments();
}

async function pullGameComments() {
  const type = S.gameType;
  if (!type || S.route !== "games") return;
  if (S.gameCommentsType && S.gameCommentsType !== type) {
    S.gameComments = [];
    S.gameCommentsSig = "";
  }
  const since = S.gameComments.length ? S.gameComments[S.gameComments.length - 1].id : 0;
  const data = await api("game_comments", { query: { type, since: since || undefined } });
  if (since > 0) {
    if (data.comments.length) S.gameComments = S.gameComments.concat(data.comments);
  } else {
    S.gameComments = data.comments || [];
  }
  S.gameCommentsType = type;
  paintGameComments();
}

async function reloadGame() {
  if (!S.gameType) return;
  const data = await api("game", { query: { type: S.gameType } });
  S.game = data.game;
  S.selected = S.game.mustFrom || null;
  S.solSel = null;
  paintGame();
}

async function solMove(payload) {
  const data = await api("game_move", {
    method: "POST",
    json: { type: "solitaire", version: S.game.version, ...payload },
  });
  S.game = data.game;
  S.solSel = null;
  checkTurnNotify(S.game);
  paintGame();
  refreshState().catch(() => {});
}

async function kahootMove(payload) {
  const data = await api("game_move", {
    method: "POST",
    json: { type: "kahoot", version: S.game.version, ...payload },
  });
  S.game = data.game;
  checkTurnNotify(S.game);
  paintGame();
  refreshState().catch(() => {});
}

async function playC4(col) {
  const data = await api("game_move", {
    method: "POST",
    json: { type: "connect4", col, version: S.game.version },
  });
  S.game = data.game;
  checkTurnNotify(S.game);
  if (S.game.winner && S.game.winner !== "draw" && typeof BuzzMotion !== "undefined") BuzzMotion.confetti(28);
  paintGame();
  refreshState().catch(() => {});
}

async function playMemory(index) {
  const data = await api("game_move", {
    method: "POST",
    json: { type: "memory", index, version: S.game.version },
  });
  S.game = data.game;
  checkTurnNotify(S.game);
  if (S.game.winner && typeof BuzzMotion !== "undefined") BuzzMotion.confetti(28);
  paintGame();
  refreshState().catch(() => {});
}

async function playTtt(index) {
  const data = await api("game_move", {
    method: "POST",
    json: { type: "tictactoe", index, version: S.game.version },
  });
  S.game = data.game;
  checkTurnNotify(S.game);
  paintGame();
  refreshState().catch(() => {});
}

async function pickSquare(row, col) {
  const game = S.game;
  if (!game || !game.yourTurn) return;
  const piece = game.board[row][col];
  const side = piece === "r" || piece === "R" ? "red" : piece === "b" || piece === "B" ? "black" : null;
  const dest = S.selected && (game.legal || []).some((move) => (
    move.from[0] === S.selected[0] && move.from[1] === S.selected[1] && move.to[0] === row && move.to[1] === col
  ));
  if (dest) {
    const data = await api("game_move", {
      method: "POST",
      json: { type: "checkers", from: S.selected, to: [row, col], version: game.version },
    });
    S.game = data.game;
    S.selected = data.game.mustFrom || null;
    checkTurnNotify(S.game);
    paintGame();
    refreshState().catch(() => {});
    return;
  }
  if (side === game.youAre) {
    S.selected = [row, col];
    paintGame();
  }
}

function ytId(input) {
  const raw = String(input || "").trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1, 12);
    const watch = url.searchParams.get("v");
    if (watch && /^[\w-]{11}$/.test(watch)) return watch;
    const match = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
    if (match) return match[1];
  } catch {
    return null;
  }
  return null;
}

function playerVideoId() {
  if (!S.player || typeof S.player.getVideoData !== "function") return "";
  try {
    return S.player.getVideoData().video_id || "";
  } catch {
    return "";
  }
}

function setupWatch() {
  if (!document.getElementById("player") || S.player) return;
  if (window.YT && window.YT.Player) {
    createPlayer();
    return;
  }
  window.onYouTubeIframeAPIReady = () => createPlayer();
  if (!document.getElementById("yt-api")) {
    const tag = document.createElement("script");
    tag.id = "yt-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

function createPlayer() {
  if (!document.getElementById("player") || S.player || !window.YT) return;
  const start = S.watchLoadPending || S.watch;
  S.player = new YT.Player("player", {
    videoId: start?.videoId || undefined,
    playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: start?.playing ? 1 : 0 },
    events: {
      onReady: (event) => {
        const frame = event.target.getIframe();
        frame.style.width = "100%";
        frame.style.height = "100%";
        const pending = S.watchLoadPending;
        S.watchLoadPending = null;
        if (pending) applyWatchToPlayer(pending, { local: true });
        else if (S.watch?.videoId) applyWatchToPlayer(S.watch, { local: Number(S.watch.updatedBy) === Number(S.user?.id) });
      },
      onStateChange: onWatchState,
    },
  });
}

function applyWatchToPlayer(watch, { local = false } = {}) {
  if (!watch?.videoId) return;
  if (!S.player || typeof S.player.loadVideoById !== "function") {
    S.watchLoadPending = watch;
    setupWatch();
    return;
  }
  if (!local && Number(watch.updatedBy) === Number(S.user?.id)) return;
  S.applyingWatch = true;
  try {
    const current = playerVideoId();
    const time = local && !watch.playing ? watch.position || 0 : expectedTime(watch);
    if (current !== watch.videoId) {
      if (watch.playing || local) S.player.loadVideoById({ videoId: watch.videoId, startSeconds: time });
      else S.player.cueVideoById({ videoId: watch.videoId, startSeconds: watch.position || 0 });
    } else {
      if (Math.abs((S.player.getCurrentTime() || 0) - time) > 1.8) S.player.seekTo(time, true);
      const state = S.player.getPlayerState();
      if (watch.playing && state !== YT.PlayerState.PLAYING) S.player.playVideo();
      if (!watch.playing && state === YT.PlayerState.PLAYING) S.player.pauseVideo();
    }
  } catch {
    /* player not ready yet */
  }
  setTimeout(() => {
    S.applyingWatch = false;
    try {
      S.lastT = S.player?.getCurrentTime?.();
    } catch {
      S.lastT = null;
    }
    S.lastTAt = Date.now();
  }, 800);
}

function onWatchState(event) {
  if (S.applyingWatch || !window.YT) return;
  if (event.data === YT.PlayerState.PLAYING) schedulePush(true);
  if (event.data === YT.PlayerState.PAUSED) schedulePush(false);
}

let pushTimer = null;
function schedulePush(playing) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushWatch(playing), 350);
}

async function pushWatch(playing) {
  if (!S.player || S.applyingWatch || typeof S.player.getVideoData !== "function") return;
  const id = S.player.getVideoData().video_id;
  if (!id) return;
  const data = await api("watch", {
    method: "POST",
    json: { videoId: id, position: S.player.getCurrentTime() || 0, playing: !!playing },
  });
  S.watch = data.watch;
}

function expectedTime(watch) {
  if (!watch || !watch.playing) return watch?.position || 0;
  const now = Date.now() / 1000 + (S.clockOffset || 0);
  return (watch.position || 0) + Math.max(0, now - (watch.updatedAt || now));
}

function applyRemoteWatch(watch) {
  applyWatchToPlayer(watch, { local: false });
}

function maybePushSeek() {
  if (!window.YT || !S.player || S.applyingWatch || typeof S.player.getCurrentTime !== "function") return;
  let time;
  let state;
  try {
    time = S.player.getCurrentTime();
    state = S.player.getPlayerState();
  } catch {
    return;
  }
  if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.PAUSED) {
    S.lastT = time;
    S.lastTAt = Date.now();
    return;
  }
  const playing = state === YT.PlayerState.PLAYING;
  if (S.lastT == null) {
    S.lastT = time;
    S.lastTAt = Date.now();
    return;
  }
  const dt = (Date.now() - S.lastTAt) / 1000;
  const jumped = Math.abs(time - S.lastT - (playing ? dt : 0)) > 2.2;
  S.lastT = time;
  S.lastTAt = Date.now();
  if (jumped) pushWatch(playing);
}

async function pullWatch() {
  maybePushSeek();
  const data = await api("watch");
  S.clockOffset = data.serverNow - Date.now() / 1000;
  const watch = data.watch;
  const prevVideo = S.watch?.videoId;
  const changed = !S.watch || watch.updatedAt !== S.watch.updatedAt || watch.videoId !== S.watch.videoId || watch.playing !== S.watch.playing;
  S.watch = watch;
  if (!watch.videoId) return;
  const mine = Number(watch.updatedBy) === Number(S.user?.id);
  if (changed) {
    if (mine) applyWatchToPlayer(watch, { local: true });
    else applyRemoteWatch(watch);
    if (watch.videoId !== prevVideo) {
      S.watchComments = [];
      S.watchCommentsSig = "";
      S.watchCommentsVideo = watch.videoId;
      paintWatchComments();
      pullWatchComments().catch(() => {});
    }
    return;
  }
  if (mine && playerVideoId() !== watch.videoId) applyWatchToPlayer(watch, { local: true });
}

function paintWatchComments() {
  const list = document.getElementById("watch-msgs");
  if (!list) return;
  const sig = S.watchComments.map((c) => c.id).join(",");
  if (sig === S.watchCommentsSig && S.watchCommentsVideo === (S.watch?.videoId || "")) return;
  S.watchCommentsSig = sig;
  S.watchCommentsVideo = S.watch?.videoId || "";
  list.innerHTML = watchCommentsHtml();
  list.scrollTop = list.scrollHeight;
  const form = document.querySelector("[data-form='watch-chat']");
  const vid = S.watch?.videoId;
  if (form) {
    form.hidden = !vid;
    form.querySelectorAll("input, button").forEach((el) => { el.disabled = !vid; });
    if (!vid) closeEmojiBars();
  }
  const hint = document.querySelector(".watch-chat-hint");
  if (hint) hint.textContent = vid ? "Comments for this video only." : "Pick a video to chat here.";
}

async function pullWatchComments() {
  const vid = S.watch?.videoId;
  if (!vid || S.route !== "watch") return;
  if (S.watchCommentsVideo && S.watchCommentsVideo !== vid) {
    S.watchComments = [];
    S.watchCommentsSig = "";
  }
  const since = S.watchComments.length ? S.watchComments[S.watchComments.length - 1].id : 0;
  const data = await api("watch_comments", { query: { video: vid, since: since || undefined } });
  if (since > 0) {
    if (data.comments.length) S.watchComments = S.watchComments.concat(data.comments);
  } else {
    S.watchComments = data.comments || [];
  }
  S.watchCommentsVideo = vid;
  paintWatchComments();
}

function setCallStatus(text) {
  S.callStatus = text;
  const el = document.getElementById("call-status");
  if (el) el.textContent = text;
}

function paintCallActions() {
  const el = document.getElementById("call-actions");
  if (el) el.innerHTML = callActionsHtml();
}

function attachCallMedia() {
  const local = document.getElementById("local-video");
  const remote = document.getElementById("remote-video");
  if (local && Call.local) local.srcObject = Call.local;
  if (remote && Call.remote) remote.srcObject = Call.remote;
}

function showIncoming() {
  const caller = (S.bubbles || []).find((bubble) => bubble.id === S.incomingBubbleId);
  const name = caller?.partner?.displayName || "Someone";
  document.getElementById("toast-text").textContent = `${name} is calling.`;
  document.getElementById("toast-actions").innerHTML = `<button class="btn rose" type="button" data-act="answer-call">Answer</button><button class="btn ghost" type="button" data-act="decline-call">Not now</button>`;
  document.getElementById("toast").hidden = false;
}

function hideToast() {
  document.getElementById("toast").hidden = true;
}

async function signalSend(kind, payload, bubbleId) {
  await api("signal", { method: "POST", json: { kind, payload }, bubbleId: bubbleId || S.callBubbleId || S.bubble?.id });
}

async function flushIce() {
  const queued = S.earlyIce.splice(0);
  for (const candidate of queued) {
    try {
      await Call.pc.addIceCandidate(candidate);
    } catch {
      /* ignore late candidates */
    }
  }
}

async function ensureMedia() {
  if (Call.local) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Video calls need a browser that allows the camera on localhost or HTTPS.");
  }
  try {
    Call.local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    throw new Error("Allow the camera and microphone, then try the call again.");
  }
  const local = document.getElementById("local-video");
  if (local) local.srcObject = Call.local;
}

function setupPeer() {
  Call.pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  Call.local.getTracks().forEach((track) => Call.pc.addTrack(track, Call.local));
  Call.pc.ontrack = (event) => {
    Call.remote = event.streams[0];
    const video = document.getElementById("remote-video");
    if (video) video.srcObject = event.streams[0];
    setCallStatus("You're live");
  };
  Call.pc.onicecandidate = (event) => {
    if (event.candidate) signalSend("ice", event.candidate.toJSON());
  };
  Call.pc.onconnectionstatechange = () => {
    const state = Call.pc?.connectionState;
    if (state === "connected") setCallStatus("You're live");
    if (state === "failed") setCallStatus("The call could not connect. Try again in a moment.");
    if (state === "disconnected") setCallStatus("Reconnecting…");
  };
}

async function startCall() {
  if (S.incomingOffer && !Call.active) return acceptCall();
  if (Call.pc) return;
  S.callBubbleId = S.bubble?.id || null;
  await ensureMedia();
  setupPeer();
  Call.active = true;
  Call.making = true;
  const offer = await Call.pc.createOffer();
  await Call.pc.setLocalDescription(offer);
  await signalSend("offer", { type: offer.type, sdp: offer.sdp });
  paintCallActions();
  setCallStatus(`Calling ${partnerName()}…`);
}

async function acceptCall() {
  if (!S.incomingOffer) return;
  hideToast();
  if (S.incomingBubbleId && S.bubble?.id !== S.incomingBubbleId) {
    const next = (S.bubbles || []).find((bubble) => bubble.id === S.incomingBubbleId && bubble.status === "active");
    if (next) {
      S.bubble = next;
      rememberBubble(next.id);
      S.chat = [];
      S.notes = [];
      S.moments = [];
      S.game = null;
    }
  }
  S.callBubbleId = S.bubble?.id || S.incomingBubbleId;
  if (S.route !== "call") await go("call", { force: true });
  await ensureMedia();
  if (!Call.pc) setupPeer();
  Call.active = true;
  Call.making = false;
  await Call.pc.setRemoteDescription(new RTCSessionDescription(S.incomingOffer));
  await flushIce();
  const answer = await Call.pc.createAnswer();
  await Call.pc.setLocalDescription(answer);
  await signalSend("answer", { type: answer.type, sdp: answer.sdp });
  paintCallActions();
  setCallStatus("Connecting…");
}

async function endCall(send) {
  if (send && S.bubble && S.bubble.status === "active") {
    try {
      await signalSend("hangup", {});
    } catch {
      /* already leaving */
    }
  }
  if (Call.pc) {
    Call.pc.ontrack = null;
    Call.pc.close();
  }
  Call.pc = null;
  Call.active = false;
  Call.making = false;
  if (Call.local) Call.local.getTracks().forEach((track) => track.stop());
  Call.local = null;
  Call.remote = null;
  S.incomingOffer = null;
  S.incomingBubbleId = null;
  S.callBubbleId = null;
  S.earlyIce = [];
  S.micOff = false;
  S.camOff = false;
  const local = document.getElementById("local-video");
  const remote = document.getElementById("remote-video");
  if (local) local.srcObject = null;
  if (remote) remote.srcObject = null;
  hideToast();
  paintCallActions();
  setCallStatus("Call ended");
}

async function handleSignal(sig) {
  if (sig.kind === "pulse") {
    if (sig.bubbleId === S.bubble?.id && typeof BuzzMotion !== "undefined") {
      BuzzMotion.partnerPulse(partnerName());
    }
    return;
  }
  const forThisCall = !sig.bubbleId || sig.bubbleId === S.callBubbleId || sig.bubbleId === S.incomingBubbleId;
  if (sig.kind === "hangup") {
    if (!forThisCall && S.callBubbleId) return;
    hideToast();
    S.incomingOffer = null;
    S.incomingBubbleId = null;
    if (Call.pc || Call.local) await endCall(false);
    else setCallStatus("Call ended");
    return;
  }
  if (sig.kind === "offer") {
    if (Call.making) return;
    S.incomingOffer = sig.payload;
    S.incomingBubbleId = sig.bubbleId || S.bubble?.id || null;
    if (!Call.active) showIncoming();
    return;
  }
  if (sig.bubbleId && S.callBubbleId && sig.bubbleId !== S.callBubbleId) return;
  if (sig.kind === "answer" && Call.pc) {
    await Call.pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
    await flushIce();
    setCallStatus("Connected");
    return;
  }
  if (sig.kind === "ice") {
    if (Call.pc && Call.pc.remoteDescription) {
      try {
        await Call.pc.addIceCandidate(sig.payload);
      } catch {
        /* ignore */
      }
    } else S.earlyIce.push(sig.payload);
  }
}

function enqueueSignal(sig) {
  signalChain = signalChain.then(() => handleSignal(sig)).catch(() => {});
}

async function pullSignals() {
  if (!S.signalsReady) {
    const data = await api("signals", { query: { baseline: 1 } });
    S.lastSignalId = data.latest || 0;
    S.signalsReady = true;
    return;
  }
  const data = await api("signals", { query: { since: S.lastSignalId } });
  S.lastSignalId = data.latest || S.lastSignalId;
  data.signals.forEach(enqueueSignal);
}

async function openBubble(id) {
  const card = document.querySelector(`[data-act="open-bubble"][data-id="${id}"]`);
  if (card && effectsOn()) card.classList.add("bubble-expand");
  const next = (S.bubbles || []).find((bubble) => bubble.id === id && bubble.status === "active");
  if (!next) return;
  if (card && effectsOn()) await new Promise((resolve) => window.setTimeout(resolve, 320));
  if ((Call.pc || Call.local) && S.bubble?.id !== next.id) await endCall(true);
  S.bubble = next;
  S.partnerOnlineWas = false;
  rememberBubble(next.id);
  S.chat = [];
  S.notes = [];
  S.moments = [];
  S.watch = null;
  S.watchComments = [];
  S.watchCommentsSig = "";
  S.watchCommentsVideo = "";
  S.gameComments = [];
  S.gameCommentsSig = "";
  S.gameCommentsType = "";
  S.turnHadMine = undefined;
  S.momentOpen = 0;
  S.momentComments = {};
  S.game = null;
  S.gameType = null;
  await go("home", { force: true });
}

async function copyUsername() {
  const text = S.user.username;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  showFlash("Username copied.");
}

async function onClick(event) {
  const el = event.target.closest("[data-act]");
  if (!el) return;
  event.preventDefault();
  const act = el.dataset.act;
  try {
    if (act === "go") {
      if (el.dataset.mode) S.authMode = el.dataset.mode;
      if (el.dataset.lobby) {
        await go("games", { lobby: true, force: true, backTo: { route: "home" } });
        return;
      }
      const route = el.dataset.route;
      const opts = { force: route !== S.route || !!el.dataset.mode || !!el.dataset.lobby };
      if (el.dataset.backGames) opts.backTo = { route: "games", lobby: true };
      else if (el.dataset.backMore) opts.backTo = { route: "more" };
      else if (el.dataset.backHome) opts.backTo = { route: "home" };
      else if (["daily", "mood", "timeline", "playlist", "draw", "wyr", "bucket", "quiz", "scrapbook", "jar", "search", "calendar", "favorites"].includes(route)) {
        opts.backTo = S.route === "games" && !S.gameType ? { route: "games", lobby: true } : { route: "home" };
      }
      await go(route, opts);
      return;
    }
    if (act === "nav-back") {
      if (S.route === "games" && S.gameType) await tryLeaveGame();
      else navigateBack();
      return;
    }
    if (act === "game-menu") {
      if (S.game && clientGameInProgress(S.game) && !S.game.winner) {
        S.uiGameMenu = true;
        render();
      } else await leaveGameLobby();
      return;
    }
    if (act === "game-leave-pause") {
      await leaveGameLobby();
      return;
    }
    if (act === "game-leave-resign") {
      await resignCurrentGame();
      return;
    }
    if (act === "game-leave-stay") {
      S.uiGameMenu = false;
      render();
      return;
    }
    if (act === "nav-collapse") {
      S.sidebarCollapsed = !S.sidebarCollapsed;
      localStorage.setItem("buzz-nav-collapsed", S.sidebarCollapsed ? "1" : "0");
      document.querySelector(".shell")?.classList.toggle("nav-collapsed", S.sidebarCollapsed);
      const btn = document.querySelector(".nav-collapse");
      if (btn) {
        btn.textContent = S.sidebarCollapsed ? "»" : "«";
        btn.setAttribute("aria-label", S.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
      }
      return;
    }
    if (act === "visit-toggle") {
      S.visitPop = !S.visitPop;
      document.querySelectorAll(".visit-pop").forEach((el) => { el.hidden = !S.visitPop; });
      if (!document.querySelector(".visit-pop")) render();
      return;
    }
    if (act === "activity-chat-toggle") {
      const layout = document.querySelector(".activity-layout");
      if (layout) layout.classList.toggle("chat-open");
      return;
    }
    if (act === "watch-chat-toggle") {
      S.watchChatOpen = S.watchChatOpen === false;
      render();
      return;
    }
    if (act === "game-chat-toggle") {
      S.gameChatOpen = !S.gameChatOpen;
      render();
      return;
    }
    if (act === "auth-tab") {
      S.authMode = el.dataset.mode;
      S.error = "";
      S.resetStep = "";
      S.resetToken = "";
      render();
      return;
    }
    if (act === "toggle-password") {
      const id = el.dataset.for || "password";
      const input = document.getElementById(id);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      el.textContent = show ? "Hide" : "Show";
      el.setAttribute("aria-label", show ? "Hide password" : "Show password");
      return;
    }
    if (act === "forgot-password") {
      S.resetStep = "request";
      S.resetEmail = document.getElementById("email")?.value || S.resetEmail || "";
      S.error = "";
      S.flash = "";
      render();
      return;
    }
    if (act === "reset-back") {
      if (S.resetStep === "new") S.resetStep = "verify";
      else if (S.resetStep === "verify") S.resetStep = "request";
      else {
        S.resetStep = "";
        S.authMode = "login";
      }
      S.error = "";
      render();
      return;
    }
    if (act === "resend-code") {
      if (resetCooldownLeft() > 0) return;
      el.classList.add("is-loading");
      el.disabled = true;
      const data = await api("forgot_password", { method: "POST", json: { email: S.resetEmail } });
      S.resetMask = data.masked || maskResetEmail(S.resetEmail);
      S.resetExpiresAt = Date.now() + (data.expiresIn || 600) * 1000;
      S.resetCooldownUntil = Date.now() + (data.cooldown || 60) * 1000;
      let note = data.message || "If that email is registered, a code is on its way.";
      if (data.mailReady === false) {
        note += " Mail isn’t set up on this computer yet, so a code can’t arrive until SMTP is added in .env.";
      }
      showFlash(note);
      render();
      return;
    }
    if (act === "copy-user") return copyUsername();
    if (act === "emoji-toggle") {
      const key = el.dataset.for;
      const bar = document.querySelector(`.emoji-bar[data-emoji-for="${key}"]`);
      if (!bar) return;
      const willOpen = bar.hidden;
      closeEmojiBars();
      bar.hidden = !willOpen;
      scrollChatToEnd();
      return;
    }
    if (act === "emoji-pick") {
      const form = document.querySelector(`[data-form="${el.dataset.for}"]`);
      const input = form?.querySelector('[name="body"]');
      insertAtCursor(input, el.dataset.emoji || "");
      growComposer(input);
      return;
    }
    if (act === "look") {
      const patch = {};
      patch[el.dataset.key] = el.dataset.value === "none" ? "" : el.dataset.value;
      if (el.dataset.key === "mode" && currentLook().preset === "custom") {
        patch.bg = patch.mode === "dark" ? "#1c1614" : "#f6f1ec";
      }
      if (el.dataset.key === "preset" && el.dataset.value !== "custom") patch.accent = "";
      await saveLook(patch);
      return;
    }
    if (act === "open-bubble") {
      await openBubble(Number(el.dataset.id));
      return;
    }
    if (act === "accept" || act === "decline") {
      const id = Number(el.dataset.id);
      const data = await api("respond", { method: "POST", json: { accept: act === "accept", id } });
      if (act === "accept" && data.bubble) {
        S.bubble = data.bubble;
        rememberBubble(data.bubble.id);
        await refreshState();
        await go("home", { force: true });
      } else {
        await refreshState();
        S.flash = "Invite declined.";
        render();
      }
      return;
    }
    if (act === "cancel-invite") {
      await api("cancel", { method: "POST", json: { id: Number(el.dataset.id) } });
      await refreshState();
      S.flash = "Invite cancelled.";
      render();
      return;
    }
    if (act === "ask-leave") {
      S.askLeave = true;
      render();
      return;
    }
    if (act === "leave") {
      await api("leave", { method: "POST", json: {} });
      S.bubble = null;
      rememberBubble(0);
      S.chat = [];
      S.notes = [];
      S.moments = [];
      S.game = null;
      await refreshState();
      await go("bubbles", { force: true });
      return;
    }
    if (act === "logout") {
      if (Call.pc || Call.local) await endCall(true);
      await api("logout", { method: "POST", json: {} });
      S.user = null;
      S.bubble = null;
      S.bubbles = [];
      rememberBubble(0);
      S.signalsReady = false;
      S.stateReady = false;
      await go("landing", { force: true });
      return;
    }
    if (act === "swatch") {
      S.noteColor = el.dataset.color;
      document.querySelectorAll(".swatch").forEach((swatch) => swatch.classList.toggle("on", swatch.dataset.color === S.noteColor));
      return;
    }
    if (act === "delete-note") {
      const id = Number(el.dataset.id);
      await api("delete_note", { method: "POST", json: { id } });
      S.notes = S.notes.filter((note) => note.id !== id);
      S.notesSig = S.notes.map((note) => note.id).join(",");
      const grid = document.getElementById("note-grid");
      if (grid) grid.innerHTML = notesHtml();
      return;
    }
    if (act === "delete-moment") {
      const id = Number(el.dataset.id);
      await api("delete_moment", { method: "POST", json: { id } });
      S.moments = S.moments.filter((moment) => moment.id !== id);
      delete S.momentComments[id];
      if (S.momentOpen === id) S.momentOpen = 0;
      S.momentsSig = "";
      paintMomentGrid();
      return;
    }
    if (act === "date-night") {
      await runDateNight();
      return;
    }
    if (act === "mood-pick") {
      S.activityKey = "mood";
      if (!S.activity) await loadActivity("mood");
      await activityAction({ emoji: el.dataset.emoji });
      render();
      return;
    }
    if (act === "wyr-pick") {
      S.activityKey = "wyr";
      await activityAction({ action: "pick", choice: el.dataset.choice });
      render();
      return;
    }
    if (act === "playlist-play") {
      await activityAction({ action: "play", trackId: Number(el.dataset.id) });
      showFlash("Now playing for both of you.");
      render();
      return;
    }
    if (act === "playlist-react") {
      await activityAction({ action: "react", trackId: Number(el.dataset.id), emoji: el.dataset.emoji });
      if (typeof BuzzMotion !== "undefined") BuzzMotion.reactBurst(el.dataset.emoji);
      render();
      return;
    }
    if (act === "draw-color") {
      S.drawColor = el.dataset.color || "#e85d6f";
      return;
    }
    if (act === "draw-clear") {
      await activityAction({ action: "clear" });
      setupDrawCanvas();
      return;
    }
    if (act === "bucket-done") {
      await activityAction({ action: "done", id: Number(el.dataset.id) });
      if (typeof BuzzMotion !== "undefined") BuzzMotion.confetti(24);
      render();
      return;
    }
    if (act === "fav-open") {
      const type = el.dataset.type;
      const id = el.dataset.id;
      if (type === "note") await go("notes", { force: true });
      else if (type === "moment") await go("moments", { force: true });
      else if (type === "watch") await go("watch", { force: true });
      return;
    }
    if (act === "thinking") {
      await api("signal", { method: "POST", json: { kind: "pulse" } });
      document.body.classList.add("self-pulse");
      window.setTimeout(() => document.body.classList.remove("self-pulse"), 1200);
      if (typeof BuzzMotion !== "undefined") {
        BuzzMotion.heartBurst(4);
        BuzzMotion.mascotWave();
      }
      showFlash("A gentle pulse is on its way.");
      return;
    }
    if (act === "moment-react") {
      if (effectsOn()) {
        el.classList.add("react-burst");
        window.setTimeout(() => el.classList.remove("react-burst"), 520);
        if (typeof BuzzMotion !== "undefined") {
          BuzzMotion.reactBurst(el.dataset.emoji || "");
          BuzzMotion.mascotHearts();
        }
      }
      await momentReact(Number(el.dataset.id), el.dataset.emoji || "");
      S.momentsReactSig = momentReactSig(S.moments);
      return;
    }
    if (act === "moment-comments") {
      const id = Number(el.dataset.id);
      if (S.momentOpen === id) {
        S.momentOpen = 0;
        paintMomentGrid();
        return;
      }
      S.momentOpen = id;
      paintMomentGrid();
      await loadMomentComments(id);
      return;
    }
    if (act === "play") {
      const type = el.dataset.type;
      S.gameComments = [];
      S.gameCommentsSig = "";
      S.gameCommentsType = "";
      S.turnHadMine = undefined;
      S.solSel = null;
      await go("games", { gameType: type, force: true, backTo: { route: "games", lobby: true }, skipBack: true });
      pullGameComments().catch(() => {});
      return;
    }
    if (act === "game-lobby") {
      await leaveGameLobby();
      return;
    }
    if (act === "reset-game") {
      const data = await api("game_reset", { method: "POST", json: { type: S.gameType } });
      S.game = data.game;
      S.selected = null;
      S.solSel = null;
      S.turnHadMine = undefined;
      checkTurnNotify(S.game);
      paintGame();
      return;
    }
    if (act === "sol-draw") return solMove({ action: "draw" });
    if (act === "sol-waste-foundation") return solMove({ action: "waste_to_foundation" });
    if (act === "sol-foundation") {
      if (S.solSel) return solMove({ action: "tableau_to_foundation", pile: S.solSel.pile });
      return;
    }
    if (act === "sol-pick") {
      event.stopPropagation();
      const pile = Number(el.dataset.pile);
      const at = Number(el.dataset.at);
      if (S.solSel && S.solSel.pile === pile && S.solSel.at === at) {
        S.solSel = null;
        paintGame();
        return;
      }
      if (S.solSel) {
        await solMove({ action: "tableau_to_tableau", from: S.solSel.pile, to: pile, at: S.solSel.at });
        return;
      }
      S.solSel = { pile, at };
      paintGame();
      return;
    }
    if (act === "sol-col") {
      const pile = Number(el.dataset.pile);
      if (S.solSel) {
        await solMove({ action: "tableau_to_tableau", from: S.solSel.pile, to: pile, at: S.solSel.at });
        return;
      }
      await solMove({ action: "waste_to_tableau", pile });
      return;
    }
    if (act === "kahoot-pack") return kahootMove({ action: "load_pack", pack: el.dataset.pack });
    if (act === "kahoot-clear") return kahootMove({ action: "clear_questions" });
    if (act === "kahoot-start") return kahootMove({ action: "start" });
    if (act === "kahoot-next") return kahootMove({ action: "next" });
    if (act === "kahoot-answer") return kahootMove({ action: "answer", choice: Number(el.dataset.choice) });
    if (act === "c4-drop") return playC4(Number(el.dataset.col));
    if (act === "memory-flip") return playMemory(Number(el.dataset.i));
    if (act === "quiz-guess") {
      S.activityKey = "quiz";
      await activityAction({ action: "guess", choice: Number(el.dataset.choice) });
      render();
      return;
    }
    if (act === "quiz-start") {
      S.activityKey = "quiz";
      await activityAction({ action: "start" });
      render();
      return;
    }
    if (act === "jar-open") {
      S.activityKey = "jar";
      await activityAction({ action: "open", id: Number(el.dataset.id) });
      if (typeof BuzzMotion !== "undefined") BuzzMotion.heartBurst(5);
      render();
      return;
    }
    if (act === "scrap-sticker") {
      S.scrapSticker = el.dataset.sticker || "📎";
      const input = document.querySelector('form[data-form="activity-scrapbook"] input[name="sticker"]');
      if (input) input.value = S.scrapSticker;
      return;
    }
    if (act === "jar-sticker") {
      S.jarSticker = el.dataset.sticker || "💌";
      const input = document.querySelector('form[data-form="activity-jar"] input[name="sticker"]');
      if (input) input.value = S.jarSticker;
      return;
    }
    if (act === "notify-toggle") {
      S.activityKey = "hub";
      if (!S.activity) await loadActivity("hub");
      const key = el.dataset.key;
      const muted = !S.activity?.notify?.[key]?.mute;
      await activityAction({ action: "notify", key, mute: muted, sound: !muted });
      await loadActivity("hub");
      render();
      return;
    }
    if (act === "favorite") {
      S.activityKey = "hub";
      if (!S.activity) await loadActivity("hub");
      await activityAction({
        action: "favorite",
        type: el.dataset.type,
        id: Number(el.dataset.id),
        label: el.dataset.label || el.dataset.type,
      });
      showFlash("Added to favorites.");
      return;
    }
    if (act === "search-open") {
      await go(el.dataset.route || "home", { force: true });
      return;
    }
    if (act === "ttt") return playTtt(Number(el.dataset.i));
    if (act === "pick") return pickSquare(Number(el.dataset.r), Number(el.dataset.c));
    if (act === "start-call") return startCall();
    if (act === "answer-call") return acceptCall();
    if (act === "decline-call") {
      const bubbleId = S.incomingBubbleId;
      hideToast();
      S.incomingOffer = null;
      S.incomingBubbleId = null;
      if (bubbleId) await signalSend("hangup", {}, bubbleId);
      return;
    }
    if (act === "hangman-guess") {
      const data = await api("game_move", {
        method: "POST",
        json: { type: "hangman", version: S.game.version, action: "guess", letter: el.dataset.letter },
      });
      S.game = data.game;
      if (S.game.winner && typeof BuzzMotion !== "undefined") BuzzMotion.confetti(24);
      paintGame();
      return;
    }
    if (act === "hangup") return endCall(true);
    if (act === "mute" && Call.local) {
      const tracks = Call.local.getAudioTracks();
      const enabled = tracks.some((track) => track.enabled);
      tracks.forEach((track) => { track.enabled = !enabled; });
      S.micOff = enabled;
      paintCallActions();
      return;
    }
    if (act === "camera" && Call.local) {
      const tracks = Call.local.getVideoTracks();
      const enabled = tracks.some((track) => track.enabled);
      tracks.forEach((track) => { track.enabled = !enabled; });
      S.camOff = enabled;
      paintCallActions();
    }
  } catch (err) {
    if (["ttt", "pick", "reset-game", "sol-draw", "sol-pick", "sol-col", "sol-waste-foundation", "sol-foundation", "kahoot-answer", "kahoot-start", "kahoot-next", "kahoot-pack", "kahoot-clear"].includes(act)) {
      showError(err.message);
      try { await reloadGame(); } catch { /* shown already */ }
      return;
    }
    showError(err.message || "Something went wrong.");
  }
}

async function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const fd = new FormData(form);
  const button = form.querySelector('[type="submit"]');
  if (button && !["register", "login", "forgot", "verify-code", "reset-password"].includes(kind)) button.disabled = true;
  showError("");
  try {
    if (kind === "forgot") {
      const email = String(fd.get("email") || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const hint = form.querySelector('[data-hint="email"]');
        if (hint) { hint.hidden = false; hint.textContent = "That email looks off."; }
        return;
      }
      if (button) { button.classList.add("is-loading"); button.disabled = true; }
      const data = await api("forgot_password", { method: "POST", json: { email } });
      S.resetEmail = email;
      S.resetMask = data.masked || maskResetEmail(email);
      S.resetStep = "verify";
      S.resetExpiresAt = Date.now() + (data.expiresIn || 600) * 1000;
      S.resetCooldownUntil = Date.now() + (data.cooldown || 60) * 1000;
      S.flash = data.message || "If that email is registered, a code is on its way.";
      if (data.mailReady === false) {
        S.flash += " Mail isn’t set up on this computer yet, so a code can’t arrive until SMTP is added in .env.";
      }
      S.error = "";
      render();
      return;
    }
    if (kind === "verify-code") {
      const code = collectResetCode();
      const hint = form.querySelector('[data-hint="code"]');
      if (code.length !== 6) {
        if (hint) { hint.hidden = false; hint.textContent = "Enter all 6 digits."; }
        return;
      }
      if (button) { button.classList.add("is-loading"); button.disabled = true; }
      try {
        const data = await api("verify_reset_code", { method: "POST", json: { email: S.resetEmail, code } });
        S.resetToken = data.resetToken;
        S.resetStep = "new";
        S.error = "";
        render();
      } catch (err) {
        const msg = friendlyAuthError(err.message);
        if (hint) { hint.hidden = false; hint.textContent = msg; }
        else showError(msg);
      }
      return;
    }
    if (kind === "reset-password") {
      const password = String(fd.get("password") || "");
      const confirm = String(fd.get("passwordConfirm") || "");
      const passHint = form.querySelector('[data-hint="password"]');
      const confHint = form.querySelector('[data-hint="confirm"]');
      if (password.length < 8) {
        if (passHint) { passHint.hidden = false; passHint.textContent = "Use at least 8 characters for your password."; }
        return;
      }
      if (password !== confirm) {
        if (confHint) { confHint.hidden = false; confHint.textContent = "Those passwords don’t match."; }
        return;
      }
      if (button) { button.classList.add("is-loading"); button.disabled = true; }
      const data = await api("reset_password", { method: "POST", json: { resetToken: S.resetToken, password, passwordConfirm: confirm } });
      S.resetStep = "";
      S.resetToken = "";
      S.flash = "Password updated. Welcome back ♥";
      if (data.user) {
        await refreshState();
        await go(S.bubble?.status === "active" ? "home" : "bubbles", { force: true, keepFlash: true });
      } else {
        S.authMode = "login";
        render();
      }
      return;
    }
    if (kind === "register" || kind === "login") {
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");
      const name = String(fd.get("name") || "").trim();
      const emailHint = form.querySelector('[data-hint="email"]');
      const passHint = form.querySelector('[data-hint="password"]');
      const nameHint = form.querySelector('[data-hint="name"]');
      if (emailHint) { emailHint.hidden = true; emailHint.textContent = ""; }
      if (passHint) { passHint.hidden = true; passHint.textContent = ""; }
      if (nameHint) { nameHint.hidden = true; nameHint.textContent = ""; }
      let invalid = false;
      if (kind === "register" && !name) {
        if (nameHint) { nameHint.hidden = false; nameHint.textContent = "Tell us what they call you."; }
        invalid = true;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailHint) { emailHint.hidden = false; emailHint.textContent = "That email looks off."; }
        invalid = true;
      }
      if (password.length < 6) {
        if (passHint) { passHint.hidden = false; passHint.textContent = "Use at least 6 characters for your password."; }
        invalid = true;
      }
      if (invalid) return;
      if (button) {
        button.classList.add("is-loading");
        button.disabled = true;
      }
      const json = { email, password };
      if (kind === "register") json.displayName = name;
      await api(kind, { method: "POST", json });
      await refreshState();
      await go(S.bubble?.status === "active" ? "home" : "bubbles", { force: true });
      return;
    }
    if (kind === "username" || kind === "profile") {
      const json = kind === "username"
        ? { username: fd.get("username") }
        : { displayName: fd.get("displayName"), username: fd.get("username") };
      const data = await api("profile", { method: "POST", json });
      S.user = data.user;
      S.flash = "Saved.";
      render();
      return;
    }
    if (kind === "invite") {
      await api("invite", { method: "POST", json: { username: fd.get("username") } });
      await refreshState();
      S.flash = "Invite sent.";
      render();
      return;
    }
    if (kind === "chat") {
      const body = String(fd.get("body") || "").trim();
      if (!body) return;
      const sendBtn = form.querySelector('[type="submit"]');
      if (typeof BuzzMotion !== "undefined") {
        BuzzMotion.sendPulse(sendBtn);
        BuzzMotion.mascotWink();
      }
      const data = await api("message", { method: "POST", json: { body } });
      S.chat.push(data.message);
      form.reset();
      closeEmojiBars();
      growComposer(form.querySelector("textarea"));
      const list = document.getElementById("msgs");
      if (list) {
        appendChatMessage(data.message);
        list.scrollTop = list.scrollHeight;
      }
      markSectionSeen("chat");
      return;
    }
    if (kind === "visit") {
      const raw = String(fd.get("nextVisit") || "").trim();
      const data = await api("bubble_meta", { method: "POST", json: { nextVisitAt: raw || null } });
      if (data.bubble) {
        S.bubble = data.bubble;
        const inList = (S.bubbles || []).find((b) => b.id === data.bubble.id);
        if (inList) Object.assign(inList, data.bubble);
      }
      S.visitPop = false;
      showFlash(raw ? "Visit date saved." : "Visit date cleared.");
      render();
      return;
    }
    if (kind === "activity-chat") {
      const key = form.dataset.activityKey;
      const body = String(fd.get("body") || "").trim();
      if (!key || !body) return;
      const data = await api("activity_comment", { method: "POST", json: { key, body } });
      const list = S.activityComments[key] || [];
      list.push(data.comment);
      S.activityComments[key] = list;
      form.reset();
      closeEmojiBars();
      growComposer(form.querySelector("textarea"));
      paintActivityComments();
      scrollChatToEnd();
      return;
    }
    if (kind === "activity-daily") {
      await activityAction({ action: "answer", text: fd.get("text") });
      showFlash("Answer sent — waiting to reveal.");
      render();
      return;
    }
    if (kind === "activity-playlist") {
      await activityAction({ action: "add", title: fd.get("title"), url: fd.get("url") });
      form.reset();
      render();
      return;
    }
    if (kind === "activity-milestone") {
      await activityAction({ action: "milestone", title: fd.get("title"), date: fd.get("date") });
      S.timelineFeed = await api("timeline_feed");
      form.reset();
      render();
      return;
    }
    if (kind === "activity-bucket") {
      await activityAction({ action: "add", text: fd.get("text") });
      form.reset();
      render();
      return;
    }
    if (kind === "activity-calendar") {
      S.activityKey = "hub";
      await activityAction({ action: "calendar", title: fd.get("title"), at: fd.get("at"), kind: "date" });
      form.reset();
      render();
      return;
    }
    if (kind === "hub-search") {
      const q = String(fd.get("q") || "").trim();
      const data = await api("search", { query: { q } });
      S.searchResults = data.results || [];
      S.backTo = { route: "home" };
      await go("search", { force: true, backTo: { route: "home" } });
      return;
    }
    if (kind === "activity-quiz") {
      S.activityKey = "quiz";
      await activityAction({
        action: "add",
        prompt: fd.get("prompt"),
        choices: [fd.get("c0"), fd.get("c1"), fd.get("c2"), fd.get("c3")],
        correct: Number(fd.get("correct")),
      });
      form.reset();
      render();
      return;
    }
    if (kind === "activity-scrapbook") {
      S.activityKey = "scrapbook";
      await activityAction({
        action: "page",
        caption: fd.get("caption"),
        body: fd.get("body"),
        momentId: Number(fd.get("momentId") || 0),
        sticker: fd.get("sticker") || S.scrapSticker,
      });
      form.reset();
      render();
      return;
    }
    if (kind === "activity-jar") {
      S.activityKey = "jar";
      let voiceFile = "";
      const voice = fd.get("voice");
      if (voice && voice.size) {
        const upload = new FormData();
        upload.append("audio", voice);
        const up = await api("jar_voice", { method: "POST", body: upload });
        voiceFile = up.voiceFile || "";
      }
      const body = String(fd.get("body") || "").trim();
      if (!body && !voiceFile) {
        showError("Write a note or attach a voice clip.");
        return;
      }
      let unlockAt = String(fd.get("unlockAt") || "").trim();
      if (unlockAt) unlockAt = new Date(unlockAt).toISOString();
      await activityAction({
        action: "add",
        body: body || "A voice note for you 💕",
        unlockAt,
        sticker: fd.get("sticker") || S.jarSticker,
        voiceFile,
      });
      form.reset();
      render();
      return;
    }
    if (kind === "hangman-word") {
      const data = await api("game_move", {
        method: "POST",
        json: { type: "hangman", version: S.game.version, action: "word", word: fd.get("word") },
      });
      S.game = data.game;
      paintGame();
      return;
    }
    if (kind === "note") {
      await api("note", { method: "POST", json: { content: fd.get("content"), color: S.noteColor } });
      S.notes = (await api("notes")).notes;
      S.notesSig = S.notes.map((note) => note.id).join(",");
      form.querySelector("textarea").value = "";
      const grid = document.getElementById("note-grid");
      if (grid) grid.innerHTML = notesHtml();
      showFlash("Note pinned.");
      markSectionSeen("notes");
      return;
    }
    if (kind === "moment") {
      const file = fd.get("photo");
      if (!file || !file.size) {
        showError("Choose a photo to share.");
        return;
      }
      const body = new FormData();
      body.append("caption", fd.get("caption") || "");
      body.append("photo", file);
      await api("moment", { method: "POST", body });
      S.moments = (await api("moments")).moments;
      S.momentsSig = S.moments.map((moment) => `${moment.id}:${moment.commentCount}:${JSON.stringify(moment.reactionCounts)}:${moment.myReaction || ""}`).join("|");
      form.reset();
      paintMomentGrid();
      showFlash("Shared.");
      markSectionSeen("moments");
      return;
    }
    if (kind.startsWith("moment-comment-")) {
      const momentId = Number(kind.slice("moment-comment-".length));
      const body = String(fd.get("body") || "").trim();
      if (!momentId || !body) return;
      const data = await api("moment_comment", { method: "POST", json: { momentId, body } });
      const list = S.momentComments[momentId] || [];
      list.push(data.comment);
      S.momentComments[momentId] = list;
      const moment = S.moments.find((row) => row.id === momentId);
      if (moment) moment.commentCount = (moment.commentCount || 0) + 1;
      form.reset();
      closeEmojiBars();
      paintMomentGrid();
      return;
    }
    if (kind === "game-chat") {
      const type = S.gameType;
      const body = String(fd.get("body") || "").trim();
      if (!type) return;
      if (!body) return;
      const data = await api("game_comment", { method: "POST", json: { gameType: type, body } });
      S.gameComments.push(data.comment);
      S.gameCommentsSig = S.gameComments.map((c) => c.id).join(",");
      form.reset();
      closeEmojiBars();
      growComposer(form.querySelector("textarea"));
      paintGameComments();
      scrollChatToEnd();
      return;
    }
    if (kind === "kahoot-add") {
      const correct = Number(fd.get("correct"));
      await kahootMove({
        action: "add_question",
        prompt: fd.get("prompt"),
        choices: [fd.get("c0"), fd.get("c1"), fd.get("c2"), fd.get("c3")],
        correct,
      });
      form.reset();
      return;
    }
    if (kind === "watch-chat") {
      const vid = S.watch?.videoId;
      const body = String(fd.get("body") || "").trim();
      if (!vid) {
        showError("Start a video before commenting.");
        return;
      }
      if (!body) return;
      const data = await api("watch_comment", { method: "POST", json: { videoId: vid, body } });
      S.watchComments.push(data.comment);
      S.watchCommentsSig = S.watchComments.map((c) => c.id).join(",");
      form.reset();
      closeEmojiBars();
      growComposer(form.querySelector("textarea"));
      paintWatchComments();
      scrollChatToEnd();
      markSectionSeen("watch");
      return;
    }
    if (kind === "watch") {
      const id = ytId(fd.get("url"));
      if (!id) {
        showError("Paste a full YouTube link.");
        return;
      }
      const data = await api("watch", { method: "POST", json: { videoId: id, position: 0, playing: true } });
      S.watch = data.watch;
      S.watchComments = [];
      S.watchCommentsSig = "";
      applyWatchToPlayer(S.watch, { local: true });
      paintWatchComments();
      pullWatchComments().catch(() => {});
      markSectionSeen("watch");
      showFlash("Playing together.");
    }
  } catch (err) {
    const msg = friendlyAuthError(err.message);
    if (kind === "register" || kind === "login") {
      const emailHint = form.querySelector('[data-hint="email"]');
      if (emailHint && /email/i.test(msg)) {
        emailHint.hidden = false;
        emailHint.textContent = msg;
      } else {
        showError(msg);
      }
    } else {
      showError(err.message || "Something went wrong.");
    }
  } finally {
    if (button && button.isConnected) {
      button.classList.remove("is-loading");
      if (["register", "login", "forgot", "verify-code", "reset-password"].includes(kind)) syncAuthSubmitState();
      else button.disabled = false;
    }
  }
}

document.addEventListener("click", onClick);
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-act='emoji-toggle'], [data-act='emoji-pick'], .emoji-bar")) return;
  closeEmojiBars();
});
document.addEventListener("input", (event) => {
  if (event.target.closest("#auth-form")) {
    const hint = event.target.closest(".field")?.querySelector(".field-hint");
    if (hint) { hint.hidden = true; hint.textContent = ""; }
    const strength = document.getElementById("pw-strength");
    const pw = document.getElementById("password");
    if (strength && pw && event.target === pw) strength.textContent = passwordStrengthHint(pw.value);
    syncAuthSubmitState();
  }
  const input = event.target.closest("[data-look-color]");
  if (!input || !S.user) return;
  const patch = { [input.dataset.lookColor]: input.value };
  if (input.dataset.lookColor === "bg") patch.preset = "custom";
  S.user = { ...S.user, appearance: normalizeLook({ ...currentLook(), ...patch }) };
  applyLook();
});
document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-look-color]");
  if (!input || !S.user) return;
  const patch = { [input.dataset.lookColor]: input.value };
  if (input.dataset.lookColor === "bg") patch.preset = "custom";
  saveLook(patch);
});
document.addEventListener("submit", onSubmit);
document.addEventListener("input", (event) => {
  if (event.target.matches?.(".composer textarea")) growComposer(event.target);
});
document.addEventListener("focusin", (event) => {
  const field = event.target.closest("input, textarea");
  if (!field) return;
  window.setTimeout(() => {
    field.scrollIntoView({ block: "center", inline: "nearest" });
    scrollChatToEnd();
  }, 80);
});
syncViewportHeight();
window.addEventListener("resize", syncViewportHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", syncViewportHeight);
  window.visualViewport.addEventListener("scroll", syncViewportHeight);
}
window.addEventListener("hashchange", () => {
  const parsed = parseRouteHash(location.hash);
  const current = routeHash(S.route, S.gameType);
  const next = routeHash(parsed.route, parsed.gameType);
  if (next === current && S.renderedRoute === parsed.route) return;
  S.hashNav = true;
  go(parsed.route, { gameType: parsed.gameType, fromHash: true, force: true, keepGame: true, skipBack: true });
});

async function boot() {
  try {
    await refreshState();
    S.stateReady = true;
  } catch (err) {
    S.bootError = err.message;
  }
  const parsed = parseRouteHash(location.hash || (S.user ? "#home" : "#landing"));
  S.hashNav = true;
  await go(parsed.route, { gameType: parsed.gameType, fromHash: true, force: true, keepGame: true });
  if (!S.polling) S.polling = setInterval(() => { tick().catch(() => {}); }, 2000);
}

boot();
