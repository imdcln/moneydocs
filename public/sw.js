// Service Worker for Web Push & Device Notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: "Notification",
      body: event.data.text(),
    };
  }

  const title = payload.title || "Money Docs Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/assets/icons/favicon2.png",
    badge: payload.badge || "/assets/icons/favicon2.png",
    tag: payload.tag || `notification-${Date.now()}`,
    renotify: true,
    vibrate: [150, 50, 150],
    data: payload.data || { url: payload.url || "/notifications" },
    actions: [
      {
        action: "open",
        title: "View Details",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If an existing window is open, focus and navigate it
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
