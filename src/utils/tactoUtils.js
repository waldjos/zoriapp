/**
 * Clasificación sencilla de hallazgos en tacto rectal para fines estadísticos.
 *
 * No sustituye un juicio clínico, solo agrupa en tres niveles:
 * - "sin_riesgo"        → tacto sin hallazgos sospechosos
 * - "riesgo_intermedio" → cambios que pueden ser benignos pero llaman la atención
 * - "alto_riesgo"       → hallazgos claramente sospechosos de patología maligna
 *
 * Estructura esperada de `tacto` (como se guarda en pacientes.tacto):
 * {
 *   tamanio: "I" | "II" | "III",
 *   fibroelastica: boolean,
 *   aumentadaConsistencia: boolean,
 *   petrea: boolean,
 *   bordes: "regulares" | "irregulares",
 *   nodulos: "si" | "no" | boolean,
 *   ladoNodulo?: "derecho" | "izquierdo",
 *   planosClivaje: "si" | "no"
 * }
 */

export function getTactoRiskCategory(tacto) {
  if (!tacto || typeof tacto !== "object") return null;

  const tamanio = tacto.tamanio || tacto.tamano || "";
  const bordes = (tacto.bordes || "").toString().toLowerCase();
  const planosClivaje = (tacto.planosClivaje || "").toString().toLowerCase();

  const nodulosValor = tacto.nodulos;
  const hayNodulos =
    nodulosValor === "si" ||
    nodulosValor === true ||
    nodulosValor === "SI";

  const consistenciaAumentada = !!tacto.aumentadaConsistencia;
  const consistenciaPetrea = !!tacto.petrea;

  const bordesIrregulares = bordes === "irregulares";
  const planosPerdidos = planosClivaje === "no";

  // Alto riesgo: nódulo palpable, consistencia pétrea, pérdida de planos
  if (hayNodulos || consistenciaPetrea || planosPerdidos) {
    return "alto_riesgo";
  }

  // Riesgo intermedio: cambios que pueden ser sospechosos pero no tan marcados
  if (consistenciaAumentada || bordesIrregulares || tamanio === "III") {
    return "riesgo_intermedio";
  }

  // Sin hallazgos sospechosos evidentes
  return "sin_riesgo";
}

