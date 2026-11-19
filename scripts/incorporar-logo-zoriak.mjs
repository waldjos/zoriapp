/**
 * Conserva el archivo oficial de Zoriak Pharma durante el build.
 * No redibuja, optimiza, ni modifica los bytes originales del SVG.
 * Si la fuente oficial no está disponible, la interfaz muestra el nombre textual.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const origen = "https://zoriakpharma.com/wp-content/uploads/2024/04/logo.svg";
const destino = resolve("public/branding/zoriak-logo-oficial.svg");

try {
  const actual = await readFile(destino);
  if (actual.length > 150 && /<svg(?:\s|>)/i.test(actual.toString("utf8"))) {
    console.log("Zoriak oficial: archivo local existente preservado.");
    process.exit(0);
  }
} catch { /* Archivo aún no está presente; intentar descargar el original. */ }

try {
  const respuesta = await fetch(origen, {
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
    headers: { Accept: "image/svg+xml" },
  });
  const finalUrl = new URL(respuesta.url);
  if (!respuesta.ok || !["zoriakpharma.com", "www.zoriakpharma.com"].includes(finalUrl.hostname)) {
    throw new Error("Origen oficial no verificable (HTTP " + respuesta.status + ").");
  }
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  if (bytes.length < 150 || bytes.length > 1024 * 1024) throw new Error("Tamaño SVG no esperado.");
  const texto = bytes.toString("utf8");
  if (!/<svg(?:\s|>)/i.test(texto) || !/<\/svg\s*>/i.test(texto)) {
    throw new Error("La respuesta no contiene un SVG completo.");
  }
  if (/<script(?:\s|>)|\bon(?:load|error|click)\s*=|javascript:/i.test(texto)) {
    throw new Error("El SVG contiene contenido ejecutable no apto para la app.");
  }
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, bytes);
  console.log("Zoriak oficial: SVG original copiado sin modificaciones (" + bytes.length + " bytes).");
} catch (error) {
  console.warn("Zoriak oficial: no se pudo guardar el logo. Se utilizará texto; no se recreará la marca. " + error.message);
}
