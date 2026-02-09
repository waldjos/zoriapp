/**
 * Normalización de nombre y cédula para guardar y mostrar:
 * - Nombres en MAYÚSCULAS
 * - Cédula solo dígitos (sin puntos ni caracteres especiales)
 * Facilita búsqueda y evita errores en los datos.
 */

export function formatoNombre(valor) {
  if (valor == null || typeof valor !== "string") return "";
  return valor.trim().toUpperCase();
}

export function formatoCedula(valor) {
  if (valor == null || typeof valor !== "string") return "";
  return valor.replace(/\D/g, "");
}

/**
 * Normaliza texto para comparación en búsqueda (sin acentos, mayúsculas).
 * Así "jose" encuentra "JOSÉ" y "maria" encuentra "MARÍA".
 * Usa NFD + rango de marcas combinadas para compatibilidad en todos los entornos.
 */
export function normalizarParaBusqueda(valor) {
  if (valor == null || typeof valor !== "string") return "";
  const s = String(valor).trim();
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}
