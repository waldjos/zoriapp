// Adaptador explícito de las pantallas originales. El servidor aplica la autorización.
import * as fs from "firebase/firestore";
import {ref,onValue,get,update,push,runTransaction as txRT,serverTimestamp as marca} from "firebase/database";
import {auth} from "../firebase";
import {dbContingencia as rt} from "./accesoContingencia";
import {datosContingencia} from "./contingencia";
import {validarTacto} from "./tactoContingencia";
import {valorPSA} from "./catia";
export const {doc,collection,serverTimestamp,orderBy,where,query,Timestamp}=fs;
let contexto=null;
export function configurarBackend(uid,sede){contexto=uid&&sede?{uid,sede}:null;}
export function enContingencia(){return contexto?.uid===auth.currentUser?.uid&&!!contexto?.sede;}
function ctx(){if(!enContingencia())throw Error("Sesión de contingencia no disponible.");return {...contexto};}
const activo=c=>auth.currentUser?.uid===c.uid&&contexto?.uid===c.uid&&contexto?.sede===c.sede;
const base="contingencia/";
const path=(c,t,id="")=>base+t+"/"+c.sede+(id?"/"+id:"");
const documento=/^[VE]-[0-9]{5,9}$/;
const snap=(id,data)=>({id,exists:()=>data!==null&&data!==undefined,data:()=>data??undefined,metadata:{fromCache:false,hasPendingWrites:false}});
const lista=docs=>({docs,size:docs.length,empty:docs.length===0,metadata:{fromCache:false,hasPendingWrites:false},forEach:cb=>docs.forEach(cb)});
const timestamp=n=>typeof n==="number"?fs.Timestamp.fromMillis(n):n;
const orden=o=>Object.entries(o||{}).sort((a,b)=>(b[1].actualizadoEn||0)-(a[1].actualizadoEn||0)||b[0].localeCompare(a[0]));
function ficha(c,id,p,t,ps,en){
 if(!p)return null;
 const tacto=orden(t)[0]?.[1],psa=orden(ps)[0]?.[1];
 return {...p,jornadaId:c.sede.replaceAll("_","-")+"-2026",createdAt:timestamp(p.createdAt),...(en?{entregaResultados:en.estado,entregaResultadosAt:timestamp(en.actualizadoEn)}:{}),...(tacto?{tacto:{...tacto,actualizadoEn:timestamp(tacto.actualizadoEn)}}:{}),...(psa?{psaTotal:psa.total,psaLibre:psa.libre,psaActualizadoEn:timestamp(psa.actualizadoEn)}:{})};
}
function clasificar(c,r){
 const raw=r.path??r._query?.path?.canonicalString?.();
 if(!raw)throw Error("Consulta no disponible en contingencia.");
 const p=raw.split("/");
 if(p[0]==="usuarios"&&p.length===2&&p[1]===c.uid)return {tipo:"perfil"};
 if(p[0]==="sedes"&&p.length===2&&p[1]===c.sede)return {tipo:"sede"};
 const prefix=c.sede==="periferico_catia"?["sedes",c.sede,"pacientes"]:["pacientes"];
 if(!prefix.every((x,i)=>p[i]===x))throw Error("Consulta fuera de la sede.");
 const tail=p.slice(prefix.length);
 if(!tail.length)return {tipo:"lista"};
 const id=tail[0].replace(/^periferico-catia-2026-/,"");
 if(!documento.test(id))throw Error("Expediente histórico no disponible durante contingencia.");
 if(tail.length===1)return {tipo:"ficha",id};
 if(tail.length===2&&tail[1]==="evaluacionesClinicas")return {tipo:"evaluaciones",id};
 throw Error("Ruta no disponible.");
}
function fuente(c,q){
 if(q.tipo==="perfil")return [base+"miembros/"+c.uid];
 if(q.tipo==="sede")return [path(c,"sedes")];
 if(q.tipo==="evaluaciones")return [path(c,"tactos",q.id)];
 return ["registros","tactos","psa","entregas"].map(t=>path(c,t,q.id));
}
function formar(c,q,v){
 if(q.tipo==="perfil")return snap(c.uid,v[0]);
 if(q.tipo==="sede")return snap(c.sede,v[0]?{activa:true,jornadaAbierta:v[0].abierta===true,jornadaId:c.sede.replaceAll("_","-")+"-2026",jornadaAnio:2026,metaPacientes:c.sede==="periferico_catia"?250:2500}:null);
 if(q.tipo==="evaluaciones")return lista(orden(v[0]).map(([id,t])=>snap(id,{...t,fecha:timestamp(t.actualizadoEn),tamano:t.tamanio,caracteristicas:{fibroelastica:t.fibroelastica,aumentadaConsistencia:t.aumentadaConsistencia,petrea:t.petrea},nodulos:{presencia:t.nodulos,derecho:["derecho","bilateral"].includes(t.ladoNodulo),izquierdo:["izquierdo","bilateral"].includes(t.ladoNodulo)},comentarios:t.comentarios||""})));
 if(q.tipo==="ficha")return snap(q.id,ficha(c,q.id,...v));
 return lista(Object.entries(v[0]||{}).filter(([id])=>documento.test(id)).map(([id,p])=>snap(id,ficha(c,id,p,v[1]?.[id],v[2]?.[id],v[3]?.[id]))));
}
async function leer(r){const c=ctx(),q=clasificar(c,r);const v=await Promise.all(fuente(c,q).map(p=>get(ref(rt,p))));if(!activo(c))throw Error("Sesión cambió.");return formar(c,q,v.map(x=>x.val()));}
export function getDoc(r){return enContingencia()?leer(r):fs.getDoc(r);}
export function getDocs(r){return enContingencia()?leer(r):fs.getDocs(r);}
export function getDocFromServer(r){return enContingencia()?leer(r):fs.getDocFromServer(r);}
export function getDocsFromServer(r){return enContingencia()?leer(r):fs.getDocsFromServer(r);}
export function onSnapshot(r,...args){
 if(!enContingencia())return fs.onSnapshot(r,...args);
 const c=ctx(),ok=typeof args[0]==="function"?args[0]:args[1],err=typeof args[0]==="function"?args[1]:args[2];
 let q;try{q=clasificar(c,r);}catch(e){queueMicrotask(()=>err?.(e));return ()=>{};}
 let online=false,alive=true;const sources=fuente(c,q),values=new Array(sources.length),ready=new Set();const emit=()=>{if(alive&&activo(c)&&online&&ready.size===sources.length)ok(formar(c,q,values));};
 const offs=[onValue(ref(rt,".info/connected"),s=>{online=s.val()===true;if(!online&&ready.size===sources.length&&alive){const x=formar(c,q,values);x.metadata.fromCache=true;ok(x);}else emit();})];
 sources.forEach((p,i)=>offs.push(onValue(ref(rt,p),s=>{values[i]=s.val();ready.add(i);emit();},e=>{if(alive)err?.(e);})));
 return ()=>{alive=false;offs.forEach(off=>off());};
}
export async function registrarContingencia(datos,uid){
 const c=ctx();if(uid!==c.uid)throw Error("Sesión incorrecta.");
 const {id,datos:d}=datosContingencia(datos,c.sede,uid);
 const r=await txRT(ref(rt,path(c,"registros",id)),old=>old===null?{...d,createdAt:marca()}:undefined,{applyLocally:false});
 if(!r.committed)throw Error("Paciente con esta cédula ya registrado en contingencia.");
 return id;
}
function datosPSA(d){const a=valorPSA(d.psaTotal),b=valorPSA(d.psaLibre);if(a===null||b!==null&&b>a)throw Error("Introduce PSA total válido y PSA libre menor o igual.");return {total:String(a),libre:b===null?"":String(b)};}
function prepararCambios(c,id,d){
 const cambios={};
 if(d.tacto){const t=validarTacto(d.tacto,c.uid);cambios[path(c,"tactos",id)+"/"+push(ref(rt,path(c,"tactos",id))).key]={...t,actualizadoEn:marca()};}
 if(d.psaTotal!=null&&String(d.psaTotal).trim()!==""||d.psaLibre!=null&&String(d.psaLibre).trim()!==""){const p=datosPSA(d);cambios[path(c,"psa",id)+"/"+push(ref(rt,path(c,"psa",id))).key]={...p,medicoId:c.uid,actualizadoEn:marca()};}
 if(d.nombreCompleto!==undefined){
  const p=datosContingencia(d,c.sede,c.uid);if(p.id!==id)throw Error("No se puede cambiar la cédula de una ficha durante contingencia.");
  for(const k of ["nombreCompleto","telefono","email","fechaNacimiento","edad","localidad","notas"])cambios[path(c,"registros",id)+"/"+k]=p.datos[k];
 }
 if(d.entregaResultados==="entregado"){cambios[path(c,"entregas",id)]={estado:"entregado",medicoId:c.uid,actualizadoEn:marca()};}
 const permitidas=["tacto","psaTotal","psaLibre","psaRegistradoPor","psaActualizadoEn","nombreCompleto","cedula","tipoDocumento","telefono","email","fechaNacimiento","edad","localidad","notas","updatedAt","entregaResultados","entregaResultadosAt"];
 if(Object.keys(d).some(k=>!permitidas.includes(k))||!Object.keys(cambios).length)throw Error("Operación no disponible en contingencia.");
 return cambios;
}
export async function updateDoc(r,d){if(!enContingencia())return fs.updateDoc(r,d);const c=ctx(),q=clasificar(c,r);if(q.tipo!=="ficha")throw Error("Ficha no válida.");await update(ref(rt),prepararCambios(c,q.id,d));}
export async function addDoc(r,d){if(!enContingencia())return fs.addDoc(r,d);const c=ctx(),q=clasificar(c,r);if(q.tipo==="lista"){if(d.psaTotal||d.psaLibre)throw Error("Registra primero el paciente y después sus valores PSA.");return {id:await registrarContingencia(d,c.uid)};}if(q.tipo!=="evaluaciones")throw Error("Ruta no válida.");const t=validarTacto({tamanio:d.tamano,...d.caracteristicas,bordes:d.bordes,nodulos:d.nodulos?.presencia,ladoNodulo:d.nodulos?.derecho&&d.nodulos?.izquierdo?"bilateral":d.nodulos?.derecho?"derecho":d.nodulos?.izquierdo?"izquierdo":"",planosClivaje:d.planosClivaje},c.uid);const p=push(ref(rt,path(c,"tactos",q.id)));await update(ref(rt),{[path(c,"tactos",q.id)+"/"+p.key]:{...t,comentarios:String(d.comentarios||"").slice(0,2000),actualizadoEn:marca()}});return {id:p.key};}
export async function runTransaction(database,fn){
 if(!enContingencia())return fs.runTransaction(database,fn);
 // Las dos transacciones originales de Catia son creación única o anexo clínico.
 let op=null;const tx={get:r=>leer(r),set:(r,d)=>{if(op)throw Error("Transacción no soportada.");op={tipo:"crear",r,d};},update:(r,d)=>{if(op)throw Error("Transacción no soportada.");op={tipo:"actualizar",r,d};}};
 const out=await fn(tx);if(op?.tipo==="crear")await registrarContingencia(op.d,ctx().uid);else if(op?.tipo==="actualizar")await updateDoc(op.r,op.d);return out;
}
