/** Separación no destructiva de jornadas: conserva la colección histórica. */
export const JORNADA_ACTUAL = 2026;

function extraerAnioFecha(valor) {
  if (!valor) return null;
  if (typeof valor?.toDate === "function") return valor.toDate().getFullYear();
  if (typeof valor?.seconds === "number") return new Date(valor.seconds * 1000).getFullYear();
  if (typeof valor?.toMillis === "function") return new Date(valor.toMillis()).getFullYear();
  if (valor instanceof Date) return valor.getFullYear();
  if (typeof valor === "string" && /^20\d{2}/.test(valor)) return Number(valor.slice(0, 4));
  return null;
}

/**
 * Registros recientes tienen jornadaAnio explícito; los históricos
 * se clasifican según la fecha real de captura/creación.
 * No asumir que un expediente sin fecha es de 2025.
 */
export function anioPaciente(paciente) {
  const a = Number(paciente?.jornadaAnio ?? paciente?.jornadaAno ?? paciente?.jornada);
  if (Number.isInteger(a) && a >= 2020 && a <= 2100) return a;
  for (const candidato of [paciente?.fechaCapturaLocal, paciente?.createdAt, paciente?.fechaRegistro]) {
    const anio = extraerAnioFecha(candidato);
    if (anio) return anio;
  }
  return null;
}
export function filtroJornada(paciente, periodo) {
  if (periodo === "todos") return true;
  if (periodo === "sin-fecha") return anioPaciente(paciente) === null;
  return anioPaciente(paciente) === Number(periodo);
}
