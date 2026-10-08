self.addEventListener("push", (event) => {
  let title = "BuzzBuds";
  let body = "Something new in your bubble.";
  try {
    const data = event.data ? event.data.json() : {};
    title = data.title || title;
    body = data.body || body;
  } catch {
    /* keep defaults */
  }
  event.waitUntil(self.registration.showNotification(title, { body, icon: "../public/brand/icon-192.png?v=31" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "notify") {
    self.registration.showNotification(data.title || "BuzzBuds", { body: data.body || "", icon: "../public/brand/icon-192.png?v=31" });
  }
});
