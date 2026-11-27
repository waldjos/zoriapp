import {SEDE_CATIA,JORNADA_CATIA} from "./catia.js";
export const VIGENCIA_MS=8*60*60*1000;
export const capturaVigente=(confirmada,ahora=Date.now())=>Number.isFinite(confirmada)&&confirmada>0&&ahora>=confirmada&&ahora-confirmada<VIGENCIA_MS;
export const camposRegistro=["sedeId","jornadaId","jornadaAnio","cedula","tipoDocumento","nombreCompleto","telefono","fechaNacimiento","edad","email","localidad","notas","creadoPor"];
export function validarColaCatia(d,uid){
 if(!d||!uid||d.sedeId!==SEDE_CATIA||d.jornadaId!==JORNADA_CATIA||d.jornadaAnio!==2026||d.creadoPor!==uid||!["V","E"].includes(d.tipoDocumento)||typeof d.cedula!=="string"||!/^\d{5,9}$/.test(d.cedula)||Object.keys(d).length!==camposRegistro.length||!camposRegistro.every(k=>Object.prototype.hasOwnProperty.call(d,k)))throw new Error("Ficha local no válida para Catia.");
 return JORNADA_CATIA+"-"+d.tipoDocumento+"-"+d.cedula;
}
export function registroCoincide(a,b){return camposRegistro.every(k=>a?.[k]===b?.[k]);}
