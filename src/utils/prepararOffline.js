/**
 * Preparación explícita del dispositivo. El OCR está incluido como archivos
 * locales y debe descargarse antes de trabajar sin red.
 */
const PAQUETE = "zoriapp-offline-paciente-v1";
const RECURSOS_OCR = [
  "/ocr/worker.min.js",
  "/ocr/core/tesseract-core.wasm.js",
  "/ocr/core/tesseract-core-simd.wasm.js",
  "/ocr/lang/spa.traineddata.gz",
];

async function rutasDeInterfaz() {
  const archivos = ["/", "/index.html", "/manifest.webmanifest"];
  document.querySelectorAll("script[src], link[rel='stylesheet'][href], link[rel='modulepreload'][href]").forEach((elemento) => {
    const ruta = elemento.getAttribute("src") || elemento.getAttribute("href");
    if (ruta && new URL(ruta, location.href).origin === location.origin) archivos.push(new URL(ruta, location.href).pathname);
  });
  return [...new Set(archivos)];
}

export async function comprobarPreparacionOffline() {
  if (!("caches" in window) || !("serviceWorker" in navigator)) return false;
  const rutas = [...RECURSOS_OCR, ...await rutasDeInterfaz()];
  for (const ruta of rutas) {
    if (!await caches.match(ruta)) return false;
  }
  return true;
}

export async function prepararOffline(alAvanzar = () => {}) {
  if (!navigator.onLine) throw new Error("Conéctate a internet una vez para preparar este dispositivo.");
  if (!("caches" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Este navegador no admite el almacenamiento offline de la aplicación.");
  }
  await navigator.serviceWorker.register("/sw.js");
  const cache = await caches.open(PAQUETE);
  const rutas = [...RECURSOS_OCR, ...await rutasDeInterfaz()];
  let completados = 0;
  for (const ruta of rutas) {
    const respuesta = await fetch(ruta, { cache: "reload" });
    if (!respuesta.ok) throw new Error("No pudo descargarse " + ruta + ". Reintenta con internet.");
    await cache.put(ruta, respuesta);
    completados++;
    alAvanzar(Math.round((completados / rutas.length) * 100));
  }
  try { await navigator.storage?.persist?.(); } catch { /* no imprescindible */ }
  if (!await comprobarPreparacionOffline()) throw new Error("No se pudo verificar el paquete offline completo.");
  return true;
}
