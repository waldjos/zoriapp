/**
 * Normalización de nombre y cédula para guardar y mostrar:
 * - Nombres en MAYÚSCULAS
 * - Cédula solo dígitos (sin puntos ni caracteres especiales)
 * Facilita búsqueda y evita errores en los datos.
 */

export function formatoNombre(valor) {
  if (valor == null) return "";
  // Acepta strings o valores antiguos (por ejemplo, números) y los convierte a texto
  const s = String(valor);
  return s.trim().toUpperCase();
}

export function formatoCedula(valor) {
  if (valor == null) return "";
  // Acepta strings o números y deja solo dígitos (sin puntos, guiones ni letras)
  const s = String(valor);
  return s.replace(/\D/g, "");
}

/** Mapa de acentos a letra base para búsqueda (misma idea que cédula: texto normalizado). */
const ACENTOS_A_BASE = {
  Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N",
  á: "A", é: "E", í: "I", ó: "O", ú: "U", ü: "U", ñ: "N",
};

/**
 * Devuelve el nombre listo para búsqueda: mayúsculas, sin acentos, espacios simples.
 * Misma idea que formatoCedula: un string normalizado para hacer includes().
 */
export function nombreParaBusqueda(valor) {
  if (valor == null) return "";
  let s = String(valor).trim().replace(/\s+/g, " ");
  if (!s) return "";
  s = s.toUpperCase();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += ACENTOS_A_BASE[s[i]] ?? s[i];
  }
  return out;
}

/** @deprecated Usar nombreParaBusqueda. Se mantiene por compatibilidad. */
export function normalizarParaBusqueda(valor) {
  return nombreParaBusqueda(valor);
}
