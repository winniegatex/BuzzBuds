/* BuzzBuds live channel: SSE with short-poll fallback */
const BuzzLive = (() => {
  let es = null;
  let pollTimer = 0;
  let reconnectTimer = 0;
  let fails = 0;
  let lastId = 0;
  let mode = "off";
  let onEvent = () => {};
  let heartbeatAt = 0;

  function status() {
    return { mode, lastId, heartbeatAt, fails };
  }

  function setBanner(text) {
    let el = document.getElementById("live-banner");
    if (!text) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "live-banner";
      el.className = "live-banner";
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.textContent = text;
  }

  function handlePayload(ev) {
    if (!ev || !ev.id) return;
    if (ev.id <= lastId) return;
    lastId = ev.id;
    heartbeatAt = Date.now();
    onEvent(ev);
  }

  async function pollOnce() {
    if (typeof api !== "function" || typeof S === "undefined" || !S.bubble) return;
    const data = await api("live_poll", { query: { after: lastId } });
    (data.events || []).forEach(handlePayload);
    heartbeatAt = Date.now();
  }

  function startPoll() {
    stopSse();
    mode = "poll";
    setBanner("Reconnecting…");
    const run = async () => {
      try {
        await pollOnce();
        setBanner("");
        fails = 0;
      } catch {
        fails += 1;
        setBanner("Reconnecting…");
      }
    };
    run();
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(run, 4000);
  }

  function stopSse() {
    if (es) {
      es.close();
      es = null;
    }
  }

  function stopPoll() {
    window.clearInterval(pollTimer);
    pollTimer = 0;
  }

  function connectSse() {
    if (typeof S === "undefined" || !S.bubble || S.bubble.status !== "active") return;
    stopSse();
    const params = new URLSearchParams({ action: "live", after: String(lastId) });
    if (S.bubbleId) params.set("bubble", String(S.bubbleId));
    es = new EventSource("api.php?" + params.toString());
    mode = "sse";
    es.addEventListener("hello", () => {
      fails = 0;
      heartbeatAt = Date.now();
      setBanner("");
    });
    es.addEventListener("ping", () => {
      heartbeatAt = Date.now();
    });
    es.addEventListener("live", (e) => {
      try {
        handlePayload(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("bye", () => {
      es && es.close();
      scheduleReconnect(200);
    });
    es.onerror = () => {
      fails += 1;
      stopSse();
      if (fails >= 2) startPoll();
      else scheduleReconnect(Math.min(8000, 400 * 2 ** fails));
    };
  }

  function scheduleReconnect(ms) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      if (document.visibilityState === "hidden" && fails >= 2) startPoll();
      else connectSse();
    }, ms);
  }

  function start(handler) {
    onEvent = handler || onEvent;
    stop();
    lastId = 0;
    fails = 0;
    if (typeof EventSource === "undefined") startPoll();
    else connectSse();
    window.clearInterval(BuzzLive._beat);
    BuzzLive._beat = window.setInterval(() => {
      if (mode === "sse" && heartbeatAt && Date.now() - heartbeatAt > 35000) {
        fails += 1;
        startPoll();
        scheduleReconnect(1000);
      }
    }, 8000);
  }

  function stop() {
    stopSse();
    stopPoll();
    window.clearTimeout(reconnectTimer);
    window.clearInterval(BuzzLive._beat);
    mode = "off";
    setBanner("");
  }

  function catchUp() {
    pollOnce().catch(() => {});
    if (typeof pullChat === "function") pullChat().catch(() => {});
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") catchUp();
  });
  window.addEventListener("online", () => {
    fails = 0;
    connectSse();
    catchUp();
  });

  return { start, stop, catchUp, status, setBanner };
})();
