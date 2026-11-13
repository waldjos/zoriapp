/**
 * Copia el motor OCR ya instalado (versión del package-lock) y descarga
 * el modelo español al directorio estático de Vite durante la compilación.
 * El modelo se descarga en el servidor de compilación, NUNCA desde un paciente.
 */
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const carpeta = resolve("public/ocr");
await mkdir(join(carpeta, "core"), { recursive: true });
await mkdir(join(carpeta, "lang"), { recursive: true });

async function copiar(origen, destino) {
  await copyFile(resolve("node_modules", origen), resolve(carpeta, destino));
  console.log("OCR listo:", destino);
}

await copiar("tesseract.js/dist/worker.min.js", "worker.min.js");
await copiar("tesseract.js-core/tesseract-core.wasm.js", "core/tesseract-core.wasm.js");
await copiar("tesseract.js-core/tesseract-core-simd.wasm.js", "core/tesseract-core-simd.wasm.js");

const url = "https://tessdata.projectnaptha.com/4.0.0/spa.traineddata.gz";
let modelo;
for (let intento = 1; intento <= 3; intento++) {
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const datos = Buffer.from(await respuesta.arrayBuffer());
    if (datos.byteLength < 100_000) throw new Error("Modelo OCR incompleto.");
    modelo = datos;
    break;
  } catch (error) {
    if (intento === 3) throw new Error("No se pudo preparar idioma español del OCR: " + error.message);
  }
}
await writeFile(join(carpeta, "lang", "spa.traineddata.gz"), modelo);
console.log("Idioma español OCR disponible offline (" + modelo.byteLength + " bytes)");
