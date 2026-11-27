export const SEDE_CATIA="periferico_catia";
export const JORNADA_CATIA="periferico-catia-2026";
export function rutaCatia(){return ["sedes",SEDE_CATIA,"pacientes"];}
export function perfilCatia(p){return p?.sedeId===SEDE_CATIA && p?.rol==="medico" && p?.activo===true;}
export function sedeCatia(s){return s?.activa===true && s?.jornadaId===JORNADA_CATIA && s?.jornadaAnio===2026;}
export function valorPSA(s){const v=String(s??"").trim().replace(",",".");if(!v)return null;if(!/^\d+(\.\d+)?$/.test(v)||!Number.isFinite(Number(v)))throw new Error("Introduce un valor PSA numérico no negativo.");return Number(v);}
