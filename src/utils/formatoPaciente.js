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
