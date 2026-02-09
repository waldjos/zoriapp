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

/** Normaliza cédula para comparación: solo dígitos (537.389 y 537389 coinciden). */
export function normalizarCedula(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/\D/g, "");
}

const numeric = /^-?\d+([.,]\d+)?$/;
const numericOrCedula = /^[\d.,\s]+$/;
const codePattern = /^\d+HDL\d+$/i;

function normalizarNumeroStr(s) {
  return String(s).replace(/\s/g, "").replace(/,/g, ".").replace(/‚/g, ".").replace(/，/g, ".");
}

function esNumero(s) {
  const n = normalizarNumeroStr(s);
  return n !== "" && numeric.test(n);
}

/**
 * Parsea una línea con formato: [código] nombre cédula PSA_total PSA_libre
 * En el archivo va primero PSA total, luego PSA libre (no invertir).
 * Ejemplo: "1HDL146 RAFAEL MEZA 537.389 2,33 1,1" -> total=2,33, libre=1,1
 */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 5) return null;

  let cedula = null;
  let nombre = "";
  let psaTotal = null;
  let psaLibre = null;

  const last = parts[parts.length - 1];
  const penult = parts[parts.length - 2];
  if (!esNumero(last) || !esNumero(penult)) return null;

  psaLibre = parseFloat(normalizarNumeroStr(last));
  psaTotal = parseFloat(normalizarNumeroStr(penult));
  let rest = parts.slice(0, -2);

  if (rest.length >= 1) {
    const ultimoRest = String(rest[rest.length - 1]).replace(/\s/g, "");
    if (/^[\d.,]+$/.test(ultimoRest)) {
      cedula = ultimoRest.replace(/\./g, "").replace(/,/g, "");
      rest = rest.slice(0, -1);
    }
  }

  if (rest.length >= 1) {
    const first = rest[0];
    if (codePattern.test(first)) {
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
