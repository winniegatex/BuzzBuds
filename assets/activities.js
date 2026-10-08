/* BuzzBuds activity plugins — self-contained screens + shared chat shell */
const BuzzActivities = (() => {
  const MOODS = ["😊", "🥰", "😌", "😢", "😤", "😴", "🤩", "😍"];
  const REACTS = ["❤️", "🔥", "😍", "🎵", "✨"];

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function activityShell(key, title, eyebrow, mainHtml) {
    const composer = typeof chatComposerHtml === "function"
      ? `<form data-form="activity-chat" data-activity-key="${esc(key)}" class="composer chat-compose watch-composer">
          <button type="button" class="btn soft emoji-btn" data-act="emoji-toggle" data-for="activity-${esc(key)}" aria-label="Add emoji">😊</button>
          <input name="body" maxlength="400" placeholder="Chat while you play…" autocomplete="off">
          <button class="btn rose" type="submit">Send</button>
          ${typeof emojiBarHtml === "function" ? emojiBarHtml(`activity-${key}`) : ""}
        </form>`
      : "";
    return `${typeof errorHtml === "function" ? errorHtml() : ""}${typeof flashHtml === "function" ? flashHtml() : ""}
      <button class="text-btn" type="button" data-act="go" data-route="home">← Hub</button>
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2>${esc(title)}</h2>
      <div class="activity-layout">
        <div class="activity-main" id="activity-root">${mainHtml}</div>
        <aside class="activity-chat glass" id="activity-chat">
          <h3>In this room</h3>
          <div id="activity-msgs" class="watch-msgs"></div>
          ${composer}
        </aside>
      </div>`;
  }

  function dailyScreen(a) {
    const act = a || {};
    let body = `<p class="daily-q">${esc(act.question || "")}</p>`;
    if (!act.mine) {
      body += `<form data-form="activity-daily" class="stack">
        <textarea name="text" maxlength="500" placeholder="Your honest answer…" required></textarea>
        <button class="btn rose" type="submit">Send answer</button>
      </form>`;
    } else if (!act.revealed) {
      body += `<p class="empty">Answer locked in. Waiting for ${esc(typeof partnerName === "function" ? partnerName() : "them")}…</p>
        <blockquote class="glass quote">${esc(act.mine)}</blockquote>`;
    } else {
      body += `<div class="reveal-grid glass">
        <div><span class="eyebrow">You</span><p>${esc(act.mine)}</p></div>
        <div><span class="eyebrow">${esc(typeof partnerName === "function" ? partnerName() : "Them")}</span><p>${esc(act.theirs || "")}</p></div>
      </div>`;
    }
    return activityShell("daily", "Daily question", "Play", body);
  }

  function moodScreen(a) {
    const picks = MOODS.map((emoji) => `<button type="button" class="mood-pick" data-act="mood-pick" data-emoji="${emoji}">${emoji}</button>`).join("");
    let body = `<p class="empty">How is your heart today?</p><div class="mood-row">${picks}</div>`;
    if (a?.mine) body += `<p>You feel <strong>${a.mine}</strong> today.</p>`;
    if (a?.theirs) body += `<p>${esc(typeof partnerName === "function" ? partnerName() : "They")} feels <strong>${a.theirs}</strong>.</p>`;
    if (!a?.mine) body += `<p class="empty">Pick one — your partner will see it once you both check in.</p>`;
    return activityShell("mood", "Mood check-in", "Share", body);
  }

  function playlistScreen(a) {
    const tracks = a?.tracks || [];
    const list = tracks.length
      ? tracks.map((t) => {
          const react = REACTS.map((e) => `<button type="button" class="react-chip" data-act="playlist-react" data-id="${t.id}" data-emoji="${e}">${e}</button>`).join("");
          return `<article class="card track-row">
            <div class="grow"><strong>${esc(t.title)}</strong>
            ${t.url ? `<p><a href="${esc(t.url)}" target="_blank" rel="noopener">Open link</a></p>` : ""}</div>
            <button class="btn soft" type="button" data-act="playlist-play" data-id="${t.id}">Listen</button>
            <div class="react-bar">${react}</div>
          </article>`;
        }).join("")
      : `<p class="empty">Add your first song — links or titles both work.</p>`;
    const body = `<form data-form="activity-playlist" class="stack">
      <input name="title" placeholder="Song title" maxlength="120">
      <input name="url" placeholder="Spotify / YouTube link (optional)">
      <button class="btn rose" type="submit">Add to playlist</button>
    </form>
    <div class="stack gap-top" id="playlist-list">${list}</div>`;
    return activityShell("playlist", "Shared playlist", "Share", body);
  }

  function drawScreen(a) {
    const body = `<p class="empty">Doodle together — your strokes sync live.</p>
      <div class="draw-toolbar row">
        <button type="button" class="btn ghost" data-act="draw-color" data-color="#e85d6f">Rose</button>
        <button type="button" class="btn ghost" data-act="draw-color" data-color="#6b4d9b">Plum</button>
        <button type="button" class="btn ghost" data-act="draw-clear">Clear</button>
      </div>
      <canvas id="draw-canvas" class="draw-canvas" width="640" height="420" aria-label="Shared drawing board"></canvas>`;
    return activityShell("draw", "Drawing board", "Create", body);
  }

  function timelineScreen(feed) {
    const items = feed?.items || [];
    const otd = feed?.onThisDay || [];
    const list = items.length
      ? items.map((it) => `<article class="timeline-item glass"><time>${esc(it.date)}</time><strong>${esc(it.title)}</strong><span class="pill">${esc(it.kind)}</span></article>`).join("")
      : `<p class="empty">Your story starts here — add a milestone or share a moment.</p>`;
    const otdHtml = otd.length ? `<section class="gap-top"><h3>On this day</h3>${otd.map((it) => `<p>${esc(it.title)} · ${esc(it.date)}</p>`).join("")}</section>` : "";
    const body = `<form data-form="activity-milestone" class="stack">
      <input name="title" placeholder="Milestone (first date, move-in…)" maxlength="80" required>
      <input name="date" type="date" required>
      <button class="btn rose" type="submit">Add milestone</button>
    </form>
    ${otdHtml}
    <div class="timeline-feed gap-top">${list}</div>`;
    return activityShell("timeline", "Memory timeline", "Share", body);
  }

  function wyrScreen(a) {
    const p = a?.prompt || {};
    const label = p.kind === "tot" ? "This or that" : "Would you rather";
    let body = `<p class="empty">${esc(label)}</p>
      <div class="wyr-grid">
        <button class="wyr-choice" type="button" data-act="wyr-pick" data-choice="a">${esc(p.a || "A")}</button>
        <button class="wyr-choice" type="button" data-act="wyr-pick" data-choice="b">${esc(p.b || "B")}</button>
      </div>`;
    if (a?.revealed) {
      body += `<p class="flash">${a.matched ? "You matched!" : "Different picks — talk about it."}</p>`;
    } else if (a?.mine) {
      body += `<p class="empty">Waiting for ${esc(typeof partnerName === "function" ? partnerName() : "them")}…</p>`;
    }
    return activityShell("wyr", label, "Play", body);
  }

  function bucketScreen(a) {
    const items = a?.items || [];
    const list = items.length
      ? items.map((it) => `<div class="card row ${it.done ? "done" : ""}"><span>${esc(it.text)}</span>
        ${it.done ? "<span>✓</span>" : `<button class="btn soft" type="button" data-act="bucket-done" data-id="${it.id}">Done!</button>`}</div>`).join("")
      : `<p class="empty">Dream up things to do together.</p>`;
    const body = `<form data-form="activity-bucket" class="stack">
      <input name="text" maxlength="120" placeholder="Skydiving, pasta night, adopt a plant…" required>
      <button class="btn rose" type="submit">Add dream</button>
    </form>
    <div class="stack gap-top">${list}</div>`;
    return activityShell("bucket", "Bucket list", "Plan", body);
  }

  function calendarScreen(hub) {
    const events = hub?.calendar || [];
    const list = events.length
      ? events.map((e) => `<p><strong>${esc(e.title)}</strong> · ${esc(e.at)} <span class="pill">${esc(e.kind)}</span></p>`).join("")
      : `<p class="empty">Add dates, calls, and anniversaries.</p>`;
    const body = `<form data-form="activity-calendar" class="stack">
      <input name="title" maxlength="80" placeholder="Date night, call, anniversary…" required>
      <input name="at" type="date" required>
      <button class="btn rose" type="submit">Add to calendar</button>
    </form>
    <div class="gap-top">${list}</div>
      <p class="gap-top"><button class="text-btn" type="button" data-act="go" data-route="look">Notification preferences</button></p>`;
    return activityShell("hub", "Shared calendar", "Plan", body);
  }

  function favoritesScreen(hub) {
    const favs = hub?.favorites || [];
    const list = favs.length
      ? favs.map((f) => `<button class="card preview" type="button" data-act="fav-open" data-type="${esc(f.type)}" data-id="${f.id}">${esc(f.label || f.type)}</button>`).join("")
      : `<p class="empty">Star notes, moments, or videos from their screens to see them here.</p>`;
    return activityShell("hub", "Favorites", "Hub", `<div class="stack">${list}</div>`);
  }

  function hubHome(badges) {
    const b = badges || {};
    const card = (route, title, sub, badgeKey, tone) => {
      const n = b[badgeKey] || 0;
      const badge = n ? `<span class="hub-badge">${n > 9 ? "9+" : n}</span>` : "";
      return `<button class="hub-card ${tone}" type="button" data-act="go" data-route="${route}">${badge}<strong>${esc(title)}</strong><span>${esc(sub)}</span></button>`;
    };
    return `${typeof errorHtml === "function" ? errorHtml() : ""}${typeof flashHtml === "function" ? flashHtml() : ""}
      ${typeof intimacyBarHtml === "function" ? intimacyBarHtml() : ""}
      <div class="quick-bar glass">
        <button class="btn rose" type="button" data-act="go" data-route="call">Video</button>
        <button class="btn soft" type="button" data-act="go" data-route="chat">Chat</button>
        <button class="btn soft" type="button" data-act="thinking">Thinking of you</button>
        <button class="btn ghost" type="button" data-act="date-night">Date night</button>
      </div>
      <p class="eyebrow">Your space</p>
      <h1>Together hub</h1>
      <div class="hub-grid">
        ${card("watch", "Watch", "Movies & shows", "hubWatch", "tone-watch")}
        ${card("chat", "Chat", "Messages", "hubChat", "tone-chat")}
        ${card("games", "Play", "Games & questions", "hubPlay", "tone-play")}
        ${card("moments", "Share", "Photos & playlist", "hubShare", "tone-share")}
        ${card("calendar", "Plan", "Calendar & lists", "hubPlan", "tone-plan")}
        ${card("draw", "Create", "Draw & notes", "hubCreate", "tone-create")}
      </div>
      <div class="hub-strip gap-top">
        <button class="qbtn" type="button" data-act="go" data-route="daily">Daily question</button>
        <button class="qbtn" type="button" data-act="go" data-route="mood">Mood</button>
        <button class="qbtn" type="button" data-act="go" data-route="timeline">Timeline</button>
        <button class="qbtn" type="button" data-act="go" data-route="playlist">Playlist</button>
        <button class="qbtn" type="button" data-act="go" data-route="wyr">Quick match</button>
        <button class="qbtn" type="button" data-act="go" data-route="bucket">Bucket list</button>
        <button class="qbtn" type="button" data-act="go" data-route="quiz">Couple quiz</button>
        <button class="qbtn" type="button" data-act="go" data-route="scrapbook">Scrapbook</button>
        <button class="qbtn" type="button" data-act="go" data-route="jar">Love jar</button>
        <button class="qbtn" type="button" data-act="go" data-route="search">Search</button>
      </div>
      <form data-form="hub-search" class="row gap-top">
        <input name="q" placeholder="Search chat, notes, moments…" maxlength="80" class="grow">
        <button class="btn soft" type="submit">Search</button>
      </form>`;
  }

  function quizScreen(a) {
    const act = a || {};
    let body = "";
    if (act.phase === "results") {
      body = `<p class="flash">Final scores — You: ${act.myScore || 0}, ${esc(typeof partnerName === "function" ? partnerName() : "Them")}: ${act.theirScore || 0}</p>`;
    } else if (act.phase === "play" && act.activeQuestion) {
      const q = act.activeQuestion;
      const choices = (q.choices || []).map((c, i) => `<button class="wyr-choice" type="button" data-act="quiz-guess" data-choice="${i}">${esc(c)}</button>`).join("");
      body = `<p class="daily-q">${esc(q.prompt)}</p><div class="wyr-grid">${choices}</div>`;
    } else {
      body = `<p class="empty">Write multiple-choice questions about <strong>you</strong>. Your partner guesses later.</p>
        <form data-form="activity-quiz" class="stack">
          <input name="prompt" maxlength="200" placeholder="e.g. My comfort food is…" required>
          <input name="c0" maxlength="80" placeholder="Choice A" required>
          <input name="c1" maxlength="80" placeholder="Choice B" required>
          <input name="c2" maxlength="80" placeholder="Choice C" required>
          <input name="c3" maxlength="80" placeholder="Choice D" required>
          <div class="field"><label>Correct answer</label>
            <select name="correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div>
          <button class="btn rose" type="submit">Add question</button>
        </form>
        ${act.canStart ? `<button class="btn rose gap-top" type="button" data-act="quiz-start">Start guessing</button>` : `<p class="empty">Each of you needs at least one question.</p>`}`;
    }
    return activityShell("quiz", "How well do you know me?", "Play", body);
  }

  function scrapbookScreen(a) {
    const pages = a?.pages || [];
    const list = pages.length
      ? pages.map((p) => {
          const img = p.momentId && typeof momentSrc === "function" ? `<img class="thumb" alt="" src="${momentSrc(p.momentId)}">` : "";
          return `<article class="card scrap-page"><span class="sticker">${esc(p.sticker || "📎")}</span>${img}<p>${esc(p.caption || p.body || "")}</p></article>`;
        }).join("")
      : `<p class="empty">Start a scrapbook page — tie it to a moment or write a memory.</p>`;
    const body = `<form data-form="activity-scrapbook" class="stack">
      <input name="caption" maxlength="200" placeholder="Caption">
      <textarea name="body" maxlength="500" placeholder="Or write a memory…"></textarea>
      <input name="momentId" type="number" min="0" placeholder="Moment ID (optional)">
      <div class="sticker-row">${["📎", "💖", "🌸", "✨", "📷"].map((s) => `<button type="button" class="sticker-pick" data-act="scrap-sticker" data-sticker="${s}">${s}</button>`).join("")}</div>
      <input type="hidden" name="sticker" value="📎">
      <button class="btn rose" type="submit">Add page</button>
    </form>
    <div class="scrap-grid gap-top">${list}</div>`;
    return activityShell("scrapbook", "Shared scrapbook", "Share", body);
  }

  function jarScreen(a) {
    const notes = a?.notes || [];
    const list = notes.length
      ? notes.map((n) => {
          if (n.locked) {
            return `<article class="card jar-note sealed"><span>${esc(n.sticker || "💌")}</span><p>Opens ${esc(n.unlockAt || "later")}</p>
              ${n.ready ? `<button class="btn rose" type="button" data-act="jar-open" data-id="${n.id}">Open</button>` : ""}</article>`;
          }
          const audio = n.voiceFile ? `<audio controls src="api.php?action=jar_audio&file=${encodeURIComponent(n.voiceFile)}&bubble=${typeof S !== "undefined" && S.bubble ? S.bubble.id : 0}"></audio>` : "";
          return `<article class="card jar-note"><span>${esc(n.sticker || "💌")}</span><p>${esc(n.body || "")}</p>${audio}</article>`;
        }).join("")
      : `<p class="empty">Drop notes for now or later — sweet surprises welcome.</p>`;
    const body = `<form data-form="activity-jar" class="stack" enctype="multipart/form-data">
      <textarea name="body" maxlength="500" placeholder="Write a love note…"></textarea>
      <input name="unlockAt" type="datetime-local">
      <div class="sticker-row">${["💌", "💖", "🥰", "✨", "🌙"].map((s) => `<button type="button" class="sticker-pick" data-act="jar-sticker" data-sticker="${s}">${s}</button>`).join("")}</div>
      <input type="hidden" name="sticker" value="💌">
      <input name="voice" type="file" accept="audio/*" capture>
      <button class="btn rose" type="submit">Seal in jar</button>
    </form>
    <div class="stack gap-top">${list}</div>`;
    return activityShell("jar", "Love notes jar", "Create", body);
  }

  function searchScreen(results) {
    const list = (results || []).length
      ? results.map((r) => `<button class="card preview" type="button" data-act="search-open" data-route="${esc(r.route)}">${esc(r.label)} <span class="pill">${esc(r.type)}</span></button>`).join("")
      : `<p class="empty">Type at least two characters to search your bubble.</p>`;
    return `${typeof errorHtml === "function" ? errorHtml() : ""}
      <button class="text-btn" type="button" data-act="go" data-route="home">← Hub</button>
      <p class="eyebrow">Hub</p>
      <h2>Search</h2>
      <form data-form="hub-search" class="row">
        <input name="q" maxlength="80" placeholder="Search…" class="grow">
        <button class="btn rose" type="submit">Go</button>
      </form>
      <div class="stack gap-top">${list}</div>`;
  }

  return {
    MOODS,
    shell: activityShell,
    hubHome,
    screens: {
      daily: dailyScreen,
      mood: moodScreen,
      playlist: playlistScreen,
      draw: drawScreen,
      timeline: timelineScreen,
      wyr: wyrScreen,
      bucket: bucketScreen,
      calendar: calendarScreen,
      favorites: favoritesScreen,
      quiz: quizScreen,
      scrapbook: scrapbookScreen,
      jar: jarScreen,
      search: searchScreen,
    },
  };
})();
