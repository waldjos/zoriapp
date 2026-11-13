/* PWA ZoriApp: archivos de interfaz + recursos OCR, sin almacenar datos clínicos. */
const VERSION = "zoriapp-registro-offline-2026-11-v1";
const SHELL = VERSION + "-shell";
const OCR = VERSION + "-ocr";
const ENTRADA = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      await Promise.all(ENTRADA.map(async (url) => {
        try { await cache.add(new Request(url, { cache: "reload" })); }
        catch { /* no impedir la instalación si falla un icono */ }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => Promise.all(nombres.filter(
      (nombre) => nombre.startsWith("zoriapp-registro-offline-") && ![SHELL, OCR].includes(nombre)
    ).map((nombre) => caches.delete(nombre)))).then(() => self.clients.claim())
  );
});

function esOcr(url) {
  if (!["https://cdn.jsdelivr.net", "https://unpkg.com", "https://tessdata.projectnaptha.com"].includes(url.origin)) return false;
  return /tesseract|traineddata|wasm|worker\.min/i.test(url.pathname);
}

async function primeroCache(request, cacheNombre) {
  const cache = await caches.open(cacheNombre);
  const existente = await caches.match(request);
  if (existente) return existente;
  const respuesta = await fetch(request);
  if (respuesta.ok || respuesta.type === "opaque") {
    try { await cache.put(request, respuesta.clone()); } catch { /* cuota de almacenamiento */ }
  }
  return respuesta;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (esOcr(url)) event.respondWith(primeroCache(req, OCR));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(async (respuesta) => {
        if (respuesta.ok) {
          try { (await caches.open(SHELL)).put("/index.html", respuesta.clone()); } catch { /* no-op */ }
        }
        return respuesta;
      }).catch(async () => {
        const cache = await caches.open(SHELL);
        return (await cache.match("/index.html")) || (await cache.match("/")) ||
          new Response("ZoriApp no se ha preparado para funcionar sin conexión.", { status: 503 });
      })
    );
    return;
  }

  // Solo archivos estáticos. No guardar respuestas de Firebase o datos de pacientes.
  const estatico = req.destination === "script" || req.destination === "style" ||
    req.destination === "font" || req.destination === "image" ||
    url.pathname.startsWith("/assets/") || /\.(js|css|wasm|woff2?|png|webp|svg)$/.test(url.pathname);
  if (estatico) event.respondWith(primeroCache(req, SHELL));
});
