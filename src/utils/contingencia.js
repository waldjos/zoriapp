import {cedulaVE,nombrePropio,nombreCompletoValido,telefonoE164VE,correoNormalizado,fechaNacimientoISO,edadDesdeFecha} from "./registroExpress.js";
export const SEDES={domingo_luciani:"Hospital Dr. Domingo Luciani",periferico_catia:"Hospital Periférico de Catia"};
export const vacia=()=>({tipoDocumento:"V",cedula:"",nombreCompleto:"",telefono:"",email:"",fechaNacimiento:"",localidad:"",notas:""});
export function datosContingencia(f,sedeId,uid){
 if(!Object.hasOwn(SEDES,sedeId)||!uid)throw Error("Cuenta sin sede autorizada.");
 const d=cedulaVE(f.cedula,f.tipoDocumento),nac=fechaNacimientoISO(f.fechaNacimiento);const manual=f.edad===""||f.edad==null?"":Number(f.edad);const edad=nac?edadDesdeFecha(nac):manual;
 if(!nombreCompletoValido(f.nombreCompleto)||(sedeId==="periferico_catia"&&!nac)||(edad!==""&&(!Number.isInteger(edad)||edad<0||edad>150)))throw Error("Comprueba nombre y fecha de nacimiento.");
 const datos={sedeId,jornadaAnio:2026,origen:"contingencia",tipoDocumento:d.tipoDocumento,cedula:d.cedula,nombreCompleto:nombrePropio(f.nombreCompleto),telefono:telefonoE164VE(f.telefono),email:correoNormalizado(f.email),fechaNacimiento:nac,edad,localidad:f.localidad.trim(),notas:f.notas.trim(),creadoPor:uid};
 if(datos.nombreCompleto.length>200||datos.localidad.length>300||datos.notas.length>2000)throw Error("Un campo supera su longitud permitida.");
 return {id:d.etiqueta,datos};
}
