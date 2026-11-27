export const SEDE_CATIA="periferico_catia";
export const JORNADA_CATIA="periferico-catia-2026";
export function rutaCatia(){return ["sedes",SEDE_CATIA,"pacientes"];}
export function perfilCatia(p){return p?.sedeId===SEDE_CATIA && p?.rol==="medico" && p?.activo===true;}
export function sedeCatia(s){return s?.activa===true && s?.jornadaId===JORNADA_CATIA && s?.jornadaAnio===2026;}
export function valorPSA(s){const v=String(s??"").trim().replace(",",".");if(!v)return null;if(!/^\d+(\.\d+)?$/.test(v)||!Number.isFinite(Number(v)))throw new Error("Introduce un valor PSA numérico no negativo.");return Number(v);}

import {cedulaVE,nombrePropio,fechaNacimientoISO,fechaParaFormulario} from "./registroExpress.js";
export const fichaCatiaVacia=()=>({tipoDocumento:"V",cedula:"",nombreCompleto:"",telefono:"",fechaNacimiento:"",email:"",localidad:"",notas:""});
// Una nueva lectura inicia una ficha independiente: nunca heredar identidad ni contacto.
export function fichaDesdeOCR(lectura={}){
 const f=fichaCatiaVacia();
 if(lectura.cedula){try{const d=cedulaVE(lectura.cedula,lectura.tipo||"V");f.cedula=d.cedula;f.tipoDocumento=d.tipoDocumento;}catch{}}
 if(lectura.nombre)f.nombreCompleto=nombrePropio(lectura.nombre);
 if(lectura.fecha){try{f.fechaNacimiento=fechaParaFormulario(fechaNacimientoISO(lectura.fecha));}catch{}}
 return f;
}
