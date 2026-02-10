/**
 * Cociente PSA libre/total (%): ayuda a evaluar riesgo de cáncer de próstata
 * cuando el PSA total está en zona gris (4-10 ng/mL).
 * <10% sugiere mayor riesgo de cáncer; >25% sugestivo de causas benignas (HBP).
 * Solo se muestra la relación cuando PSA total > 2,5 y < 10.
 */

export function shouldShowPSALibreRelation(psaTotal) {
  const t = parseFloat(psaTotal);
  if (t == null || isNaN(t)) return false;
  return t > 2.5 && t < 10;
}

export function getPSALibrePercent(psaTotal, psaLibre) {
  const t = parseFloat(psaTotal);
  const l = parseFloat(psaLibre);
  if (t == null || l == null || isNaN(t) || isNaN(l) || t <= 0) return null;
  return Math.round((l / t) * 1000) / 10;
}

export function getPSALibreInterpretation(psaTotal, psaLibre) {
  const t = parseFloat(psaTotal);
  const pct = getPSALibrePercent(psaTotal, psaLibre);
  if (pct == null) return "";
  if (t >= 4 && t <= 10) {
    if (pct < 10) return " (<10%: mayor riesgo de cáncer)";
    if (pct > 25) return " (>25%: sugestivo benigno, ej. HBP)";
    return " (zona gris 10-25%)";
  }
  return "";
}

/**
 * Clasificación simple de riesgo basado en PSA total y, si está disponible,
 * en el porcentaje PSA libre/total.
 *
 * Categorías (string):
 * - "sin_riesgo"
 * - "riesgo_intermedio"
 * - "alto_riesgo"
 *
 * Criterios usados (consenso clínico simplificado):
 * - PSA total < 4 ng/mL  → sin_riesgo
 * - PSA total 4–10 ng/mL → zona gris, se afina con PSA libre/total:
 *    - <10%  → alto_riesgo
 *    - 10–25% → riesgo_intermedio
 *    - >25% → sin_riesgo (más sugestivo de patología benigna)
 * - PSA total > 10 ng/mL → alto_riesgo
 */
export function getPSARiskCategory(psaTotal, psaLibre) {
  const t = parseFloat(psaTotal);
  if (t == null || isNaN(t) || t <= 0) return null;

  // Bajo PSA total: riesgo bajo
  if (t < 4) {
    return "sin_riesgo";
  }

  // Zona gris clásica 4–10 ng/mL: usar porcentaje libre/total si está
  if (t >= 4 && t <= 10) {
    const pct = getPSALibrePercent(psaTotal, psaLibre);
    if (pct == null) {
      // Sin PSA libre, mantener como intermedio
      return "riesgo_intermedio";
    }
    if (pct < 10) return "alto_riesgo";
    if (pct > 25) return "sin_riesgo";
    return "riesgo_intermedio";
  }

  // PSA total claramente elevado
  if (t > 10) {
    return "alto_riesgo";
  }

  return null;
}
