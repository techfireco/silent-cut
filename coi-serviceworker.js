/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*
 * This service worker adds COOP/COEP headers to enable SharedArrayBuffer
 * on environments like GitHub Pages that don't allow custom headers.
 *
 * It intercepts all fetch requests and adds the required headers:
 * - Cross-Origin-Embedder-Policy: require-corp
 * - Cross-Origin-Opener-Policy: same-origin
 *
 * On first load, it forces a single reload to activate the headers.
 */

if (typeof window === 'undefined') {
  // ===== SERVICE WORKER CONTEXT =====
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (e) => {
    // Only intercept navigation and same-origin requests
    if (
      e.request.cache === "only-if-cached" &&
      e.request.mode !== "same-origin"
    ) {
      return;
    }

    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Can't modify opaque responses
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((err) => {
          console.error("coi-serviceworker fetch error:", err);
          return new Response("Service Worker fetch error", { status: 500 });
        })
    );
  });
} else {
  // ===== WINDOW CONTEXT (registration) =====
  (async function register() {
    // Don't register on file:// protocol
    if (window.location.protocol === "file:") return;

    // Already cross-origin isolated — no need for the service worker
    if (window.crossOriginIsolated) return;

    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register(
        window.document.currentScript.src
      );

      // If the SW is installing or waiting, we need to reload once
      if (registration.active && !navigator.serviceWorker.controller) {
        // SW is active but not controlling this page yet — reload once
        window.sessionStorage.setItem("coi-sw-reloaded", "true");
        window.location.reload();
      } else if (registration.installing || registration.waiting) {
        // Wait for the SW to become active, then reload
        const sw = registration.installing || registration.waiting;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") {
            // Prevent infinite reload: only reload once per session
            if (!window.sessionStorage.getItem("coi-sw-reloaded")) {
              window.sessionStorage.setItem("coi-sw-reloaded", "true");
              window.location.reload();
            }
          }
        });
      }
    } catch (err) {
      console.warn("coi-serviceworker registration failed:", err);
    }
  })();
}
