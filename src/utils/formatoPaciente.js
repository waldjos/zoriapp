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
 * Normaliza texto para comparación en búsqueda (sin acentos, mayúsculas, espacios colapsados).
 * Acepta cualquier tipo (se convierte a string). Así "jose" encuentra "JOSÉ" y la búsqueda por nombre funciona.
 */
export function normalizarParaBusqueda(valor) {
  if (valor == null) return "";
  const s = String(valor).trim().replace(/\s+/g, " ");
  if (!s) return "";
  try {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  } catch (_) {
    return s.toUpperCase();
  }
}
