self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizePushPayload(event) {
  if (!event.data) {
    return {
      title: "SyncPlans",
      body: "Tienes una actualización pendiente.",
      url: "/summary",
      data: {},
    };
  }

  try {
    const parsed = event.data.json() || {};
    const nestedData = parsed.data && typeof parsed.data === "object" ? parsed.data : {};

    return {
      ...parsed,
      data: nestedData,
      url: parsed.url || nestedData.url || "/summary",
    };
  } catch {
    return {
      title: "SyncPlans",
      body: event.data.text() || "Tienes una actualización pendiente.",
      url: "/summary",
      data: {},
    };
  }
}

function resolveNotificationUrl(value) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : "/summary";

  try {
    return new URL(raw, self.location.origin).href;
  } catch {
    return new URL("/summary", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  const payload = normalizePushPayload(event);
  const title = payload.title || "SyncPlans";
  const targetUrl = resolveNotificationUrl(payload.url || payload.data?.url);

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || payload.data?.tag || undefined,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      ...(payload.data || {}),
      url: targetUrl,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = resolveNotificationUrl(
    event.notification.data && event.notification.data.url
  );

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        const target = new URL(targetUrl);

        if (clientUrl.origin !== target.origin) continue;

        if ("navigate" in client) {
          return client.navigate(targetUrl).then((navigatedClient) => {
            if (navigatedClient && "focus" in navigatedClient) {
              return navigatedClient.focus();
            }

            if ("focus" in client) return client.focus();
            return undefined;
          });
        }

        if ("focus" in client) return client.focus();
      }

      return clients.openWindow(targetUrl);
    })
  );
});