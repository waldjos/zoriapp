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
