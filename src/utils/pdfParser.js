/**
 * Parser de texto/PDF para importar datos HDL: cedula, nombre, psaTotal, psaLibre.
 * Uso principal: archivo .txt (una línea por persona). PDF opcional.
 */

/**
 * Extrae el texto de todas las páginas del PDF (requiere pdfjs-dist).
 * Agrupa items por línea (Y) y devuelve un array de strings (una por línea).
 */
export async function extractLinesFromPdf(pdfUrl) {
  const pdfjsLib = await import("pdfjs-dist");
  if (pdfjsLib.GlobalWorkerOptions?.workerSrc == null) {
    pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions || {};
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "4.7.76"}/build/pdf.worker.min.mjs`;
  }
  const doc = await pdfjsLib.getDocument(pdfUrl).promise;
  const numPages = doc.numPages;
  const allLines = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent({ includeMarkedContent: true });
    const items = textContent.items || [];

    // Agrupar por posición Y (redondeada) para formar líneas
    const lineMap = {};
    for (const item of items) {
      const y = item.transform ? item.transform[5] : 0;
      const lineKey = Math.round(y);
      if (!lineMap[lineKey]) lineMap[lineKey] = [];
      lineMap[lineKey].push(item.str || "");
    }

    // Ordenar líneas de arriba a abajo (Y decreciente en PDF) y unir textos
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const parts = lineMap[y];
      const line = parts.join(" ").trim();
      if (line) allLines.push(line);
    }
  }

  return allLines;
}

/**
 * Normaliza un nombre para comparación (minúsculas, sin acentos, espacios colapsados).
 */
export function normalizarNombre(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const numeric = /^-?\d+([.,]\d+)?$/;
const cedulaLike = /^[VEJPG]?-?\d{6,10}$/i;

/**
 * Intenta parsear una línea del PDF como: cedula, nombre, psaTotal, psaLibre.
 * Prueba primero columnas separadas por 2+ espacios/tabs; luego por un solo espacio.
 */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parts = trimmed.split(/\s{2,}|\t/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let cedula = null;
  let nombre = "";
  let psaTotal = null;
  let psaLibre = null;

  let i = parts.length - 1;
  if (i >= 0 && numeric.test(String(parts[i]).replace(",", "."))) {
    psaLibre = parseFloat(String(parts[i]).replace(",", "."));
    i--;
  }
  if (i >= 0 && numeric.test(String(parts[i]).replace(",", "."))) {
    psaTotal = parseFloat(String(parts[i]).replace(",", "."));
    i--;
  }

  const rest = parts.slice(0, i + 1);
  if (rest.length >= 1) {
    const first = rest[0].replace(/\s/g, "");
    if (cedulaLike.test(first) || /^\d{6,10}$/.test(first)) {
      cedula = first;
      nombre = rest.slice(1).join(" ").trim();
    } else {
      nombre = rest.join(" ").trim();
    }
  }

  if (!nombre && !cedula) return null;
  return { cedula, nombre, psaTotal, psaLibre };
}

/**
 * Parsea todas las líneas y devuelve array de { cedula, nombre, psaTotal, psaLibre }.
 * Ignora líneas que parecen encabezados (solo una palabra o "CEDULA", "NOMBRE", etc.).
 */
export function parsePdfLinesToRows(lines) {
  const headerWords = /^(cedula|ci|nombre|psa|total|libre|tacto|resultado)$/i;
  const rows = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (!parsed.nombre && !parsed.cedula) continue;
    if (parsed.nombre && parsed.nombre.split(/\s+/).length === 1 && headerWords.test(parsed.nombre)) continue;
    rows.push(parsed);
  }

  return rows;
}

/**
 * Parsea texto plano (ej. .txt): una línea por fila. Devuelve array de { cedula, nombre, psaTotal, psaLibre }.
 */
export function parseTxtToRows(text) {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return parsePdfLinesToRows(lines);
}

/**
 * Carga el PDF desde la URL pública, extrae líneas y las parsea en filas.
 */
export async function loadPdfAndParseRows(pdfUrl) {
  const lines = await extractLinesFromPdf(pdfUrl);
  return parsePdfLinesToRows(lines);
}
