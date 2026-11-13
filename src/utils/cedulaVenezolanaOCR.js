/**
 * Parser de cédula venezolana. Nunca sustituir datos por texto genérico.
 * APellidos, NOMBRES y F. NACIMIENTO pueden aparecer en líneas distintas
 * de los valores; fecha de expedición/vencimiento JAMÁS es nacimiento.
 */
// Algunas letras se confunden con números: 0/O, 1/I, 8/B y 5/S.
// Permitir letras separadas por espacios mejora la lectura de documentos laminados.
const etiquetaApellidos = /A\s*P\s*[EÉ3]\s*L\s*L\s*[IÍ1]\s*D\s*[O0]\s*[S5]/i;
const etiquetaNombres = /N\s*[O0]\s*M\s*[B8]\s*R\s*[E3]\s*[S5]/i;
const etiquetaNacimiento = /(?:F[.\s]*NAC(?:IMIENTO)?|FECHA\s*DE?\s*NAC(?:IMIENTO)?|NACIMIENTO)/i;
const etiquetaFechasExcluidas = /EXPEDICION|EXPEDICI[OÓ]N|VENCIMIENTO|EMISI[OÓ]N/i;
const fechaRegex = /\b([0-3]?\d)[\/.\-]([01]?\d)[\/.\-]((?:19|20)\d{2})\b/g;

function normalizarLineas(texto) {
  return String(texto || "").split(/\r?\n/)
    .map((l) => l.normalize("NFC").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function limpiarPersona(texto) {
  const valor = String(texto || "")
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'’-]/g, " ")
    .replace(/\s+/g, " ").trim();
  if (valor.length < 3 || valor.length > 85) return "";
  if (/\b(REPUBLICA|VENEZUELA|SOLTERO|CASADO|IDENTIDAD|CIVIL|DIRECTOR|DR)\b/i.test(valor)) return "";
  return valor;
}

function extraerEtiqueta(lineas, patron) {
  const i = lineas.findIndex((l) => patron.test(l));
  if (i < 0) return "";
  const resto = lineas[i].replace(new RegExp(patron.source, "i"), "").replace(/^[:.\s-]+/, "");
  const limpio = limpiarPersona(resto);
  if (limpio && limpio.split(" ").length <= 5 && !etiquetaNombres.test(limpio) && !etiquetaApellidos.test(limpio)) return limpio;

  for (const siguiente of lineas.slice(i + 1, i + 3)) {
    if (etiquetaNombres.test(siguiente) || etiquetaApellidos.test(siguiente) || etiquetaNacimiento.test(siguiente) || etiquetaFechasExcluidas.test(siguiente)) break;
    const persona = limpiarPersona(siguiente);
    if (persona && persona.split(" ").length <= 5) return persona;
  }
  return "";
}

function fechaValida(valor) {
  const [d, m, y] = valor.split("/").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && y >= 1880 && y <= new Date().getFullYear();
}

function fechasDeLinea(linea) {
  return [...String(linea || "").matchAll(fechaRegex)]
    .map((m) => [m[1].padStart(2,"0"), m[2].padStart(2,"0"), m[3]].join("/"))
    .filter(fechaValida);
}

function obtenerNacimiento(lineas) {
  const idx = lineas.findIndex((l) => etiquetaNacimiento.test(l));
  if (idx < 0) return "";
  // En una cédula venezolana el valor puede estar justo ENCIMA de F. NACIMIENTO.
  const actual = lineas[idx];
  if (!etiquetaFechasExcluidas.test(actual)) {
    const conEtiqueta = fechasDeLinea(actual);
    if (conEtiqueta.length) return conEtiqueta[0];
  }
  for (const desplazamiento of [-1, 1, -2, 2]) {
    const linea = lineas[idx + desplazamiento];
    if (!linea || etiquetaFechasExcluidas.test(linea)) continue;
    const fechas = fechasDeLinea(linea);
    // Si aparecen dos fechas en una línea, la primera se sitúa bajo F. NACIMIENTO.
    if (fechas.length) return fechas[0];
  }
  return "";
}

function obtenerDocumento(lineas) {
  const buscar = /\b([VE])\s*[-.:]?\s*((?:\d[.\s-]?){6,9})\b/i;
  const candidatos = [
    ...lineas.filter((l) => /\b[VE]\s*[-.:]?\s*\d{1,3}[.\s-]?\d/i.test(l)),
    ...lineas,
  ];
  for (const candidato of candidatos) {
    const coinc = candidato.match(buscar);
    if (!coinc) continue;
    const numero = coinc[2].replace(/\D/g, "");
    if (numero.length >= 6 && numero.length <= 9) return { tipo: coinc[1].toUpperCase(), cedula: numero };
  }
  return { tipo: null, cedula: "" };
}

export function extraerCedulaVenezolana(texto) {
  const lineas = normalizarLineas(texto);
  const apellidos = extraerEtiqueta(lineas, etiquetaApellidos);
  const nombres = extraerEtiqueta(lineas, etiquetaNombres);
  const documento = obtenerDocumento(lineas);
  const fecha = obtenerNacimiento(lineas);
  return {
    ...documento,
    nombres,
    apellidos,
    nombre: nombres && apellidos ? nombres + " " + apellidos : "",
    fecha,
    incompletos: [
      !documento.cedula && "cédula",
      !nombres && "nombres",
      !apellidos && "apellidos",
      !fecha && "nacimiento"
    ].filter(Boolean),
  };
}
