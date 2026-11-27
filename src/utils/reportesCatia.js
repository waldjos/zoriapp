import {SEDE_CATIA,JORNADA_CATIA,valorPSA} from "./catia.js";
export const esFichaCatia=p=>p?.sedeId===SEDE_CATIA&&p?.jornadaId===JORNADA_CATIA&&p?.jornadaAnio===2026;
export function resumenCatia(rows){
 const r=rows.filter(esFichaCatia);
 const total=r.length,tacto=r.filter(p=>p.tacto!=null).length,psa=r.filter(p=>psaSeguro(p.psaTotal)!==null).length,libre=r.filter(p=>psaSeguro(p.psaLibre)!==null).length;
 const ambos=r.filter(p=>p.tacto!=null&&psaSeguro(p.psaTotal)!==null).length;
 return {total,tacto,psa,libre,ambos,pendientes:total-ambos};
}
function psaSeguro(v){try{return valorPSA(v)}catch{return null}}
export function porcentajePSA(p){
 const a=psaSeguro(p.psaTotal),b=psaSeguro(p.psaLibre);
 return a!==null&&a>2.5&&a<10&&b!==null&&b<=a?Math.round(b/a*1000)/10:null;
}
const dato=v=>v===null||v===undefined||v===""?"Sin registrar":String(v);
const siNo=v=>v==="si"?"Sí":v==="no"?"No":"Sin registrar";
function momento(v){try{const d=v?.toDate?.();return d instanceof Date&&!isNaN(d)?d.toLocaleString("es-VE",{timeZone:"America/Caracas"}):"Sin registrar"}catch{return "Sin registrar"}}
export function fichaFilas(p){
 if(!esFichaCatia(p))throw new Error("Expediente de otra sede o jornada.");
 const t=p.tacto;
 return [
 ["Datos del paciente","Nombre completo",dato(p.nombreCompleto)],
 ["Datos del paciente","Documento",dato(p.tipoDocumento)+"-"+dato(p.cedula)],
 ["Datos del paciente","Nacimiento",dato(p.fechaNacimiento)],
 ["Datos del paciente","Edad",dato(p.edad)],
 ["Datos del paciente","Teléfono",dato(p.telefono)],
 ["Datos del paciente","Correo",dato(p.email)],
 ["Datos del paciente","Localidad",dato(p.localidad)],
 ["Datos del paciente","Notas",dato(p.notas)],
 ["Tacto rectal","Tamaño",dato(t?.tamanio)],
 ["Tacto rectal","Consistencia",t?dato([t.fibroelastica&&"Fibroelástica",t.aumentadaConsistencia&&"Aumentada",t.petrea&&"Pétrea"].filter(Boolean).join(", ")):"Sin registrar"],
 ["Tacto rectal","Bordes",dato(t?.bordes)],
 ["Tacto rectal","Nódulos",siNo(t?.nodulos)],
 ["Tacto rectal","Lado del nódulo",dato(t?.ladoNodulo)],
 ["Tacto rectal","Planos de clivaje",siNo(t?.planosClivaje)],
 ["Tacto rectal","Fecha de evaluación",momento(t?.actualizadoEn)],
 ["Laboratorio","PSA total (ng/mL)",dato(p.psaTotal)],
 ["Laboratorio","PSA libre (ng/mL)",dato(p.psaLibre)],
 ["Laboratorio","PSA libre/total (%)",dato(porcentajePSA(p))],
 ["Laboratorio","Fecha de registro",momento(p.psaActualizadoEn)]
 ];
}
