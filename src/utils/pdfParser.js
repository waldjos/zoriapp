/**
 * Parser de texto para importar datos HDL: cedula, nombre, psaTotal, psaLibre.
 * Uso: archivo .txt (una línea por persona) en public/datos-psa.txt o subido por el usuario.
 */

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
