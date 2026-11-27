import {useEffect,useState} from "react";
import {collection,doc,onSnapshot,runTransaction,updateDoc,serverTimestamp} from "firebase/firestore";
import {db,auth} from "../firebase";
import {useAuth} from "../context/AuthContext";
import {PatrocinanteZoriak} from "../components/IdentidadJornada";
import {cedulaVE,nombrePropio,nombreCompletoValido,telefonoE164VE,fechaNacimientoISO,edadDesdeFecha,correoNormalizado} from "../utils/registroExpress";
import {SEDE_CATIA,JORNADA_CATIA,rutaCatia,perfilCatia,sedeCatia,valorPSA} from "../utils/catia";
import "./Catia.css";
const tactoInicial={tamanio:"",fibroelastica:false,aumentadaConsistencia:false,petrea:false,bordes:"",nodulos:"",ladoNodulo:"",planosClivaje:""};
const nuevo={tipoDocumento:"V",cedula:"",nombreCompleto:"",telefono:"",fechaNacimiento:"",email:"",localidad:"",notas:""};
const refPaciente=id=>doc(db,...rutaCatia(),id);
function Evaluacion({p,uid,abierta}){
 const [t,setT]=useState({...tactoInicial,...p.tacto}),[total,setTotal]=useState(p.psaTotal??""),[libre,setLibre]=useState(p.psaLibre??""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const put=(k,v)=>setT(o=>({...o,[k]:v}));
 async function guardar(e,tipo){
  e.preventDefault();setMsg("");if(!abierta||auth.currentUser?.uid!==uid)return;setBusy(true);
  try{
   let datos;
   if(tipo==="tacto"){
    if(!t.tamanio||!t.bordes||!t.nodulos||!t.planosClivaje||!(t.fibroelastica||t.aumentadaConsistencia||t.petrea)||t.nodulos==="si"&&!t.ladoNodulo)throw new Error("Completa los hallazgos antes de guardar.");
    datos={tacto:{...tactoInicial,tamanio:t.tamanio,fibroelastica:!!t.fibroelastica,aumentadaConsistencia:!!t.aumentadaConsistencia,petrea:!!t.petrea,bordes:t.bordes,nodulos:t.nodulos,ladoNodulo:t.nodulos==="si"?t.ladoNodulo:"",planosClivaje:t.planosClivaje,medicoId:uid,actualizadoEn:serverTimestamp()}};
   }else{
    const a=valorPSA(total),b=valorPSA(libre);if(a===null||b!==null&&b>a)throw new Error("Verifica el PSA total y el PSA libre.");
    datos={psaTotal:String(a),psaLibre:b===null?null:String(b),psaRegistradoPor:uid,psaActualizadoEn:serverTimestamp()};
   }
   await updateDoc(refPaciente(p.id),datos);setMsg("Guardado y confirmado por Firebase.");
  }catch(e){setMsg(e.code?"No se confirmó el guardado. Revisa conexión y permisos.":e.message);}finally{setBusy(false);}
 }
 return <div className="cat-card"><h2>Evaluación clínica</h2><p><strong>{p.nombreCompleto}</strong> · {p.tipoDocumento}-{p.cedula}</p>
 <form onSubmit={e=>guardar(e,"tacto")}><h3>Tacto rectal</h3>
 { [["tamanio","Tamaño",["I","II","III"]],["bordes","Bordes",["regulares","irregulares"]],["nodulos","Nódulos",["si","no"]],["planosClivaje","Planos de clivaje",["si","no"]]].map(([k,l,opts])=><label key={k}>{l}<select required value={t[k]} onChange={e=>put(k,e.target.value)}><option value="">Seleccionar</option>{opts.map(x=><option key={x}>{x}</option>)}</select></label>)}
 {t.nodulos==="si"&&<label>Lado del nódulo<select required value={t.ladoNodulo} onChange={e=>put("ladoNodulo",e.target.value)}><option value="">Seleccionar</option><option>derecho</option><option>izquierdo</option><option>bilateral</option></select></label>}
 <fieldset><legend>Consistencia</legend>{[["fibroelastica","Fibroelástica"],["aumentadaConsistencia","Aumentada"],["petrea","Pétrea"]].map(([k,l])=><label className="cat-check" key={k}><input type="checkbox" checked={!!t[k]} onChange={e=>put(k,e.target.checked)}/>{l}</label>)}</fieldset>
 <button disabled={busy||!abierta}>Guardar evaluación</button></form>
 <form onSubmit={e=>guardar(e,"psa")}><h3>Laboratorio y PSA (ng/mL)</h3><label>PSA total<input inputMode="decimal" required value={total} onChange={e=>setTotal(e.target.value)}/></label><label>PSA libre<input inputMode="decimal" value={libre} onChange={e=>setLibre(e.target.value)}/></label><button disabled={busy||!abierta}>Guardar valores PSA</button></form><p role="status">{msg}</p>
 <p>Los valores registrados no constituyen por sí solos un diagnóstico.</p></div>;
}
export default function Catia({onLogout}){
 const {user}=useAuth(),uid=user?.uid;
 const [perfil,setPerfil]=useState(undefined),[sede,setSede]=useState(undefined),[rows,setRows]=useState(null),[error,setError]=useState(""),[tab,setTab]=useState("inicio"),[q,setQ]=useState(""),[id,setId]=useState(""),[form,setForm]=useState(nuevo),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>onSnapshot(doc(db,"usuarios",uid),{includeMetadataChanges:true},s=>{setPerfil(!s.metadata.fromCache&&!s.metadata.hasPendingWrites?s.data()??null:null);},()=>setPerfil(null)),[uid]);
 const miembro=perfilCatia(perfil);
 useEffect(()=>{setSede(undefined);if(!miembro)return;return onSnapshot(doc(db,"sedes",SEDE_CATIA),{includeMetadataChanges:true},s=>setSede(!s.metadata.fromCache&&!s.metadata.hasPendingWrites?s.data()??null:null),()=>setSede(null));},[miembro,uid]);
 const permitido=miembro&&sedeCatia(sede);
 useEffect(()=>{setRows(null);setError("");if(!permitido)return;return onSnapshot(collection(db,...rutaCatia()),{includeMetadataChanges:true},s=>{if(s.metadata.fromCache){setRows(null);setError("Sin conexión confirmada. Vuelve a conectarte.");return;}setRows(s.docs.map(d=>({...d.data(),id:d.id})));setError("");},()=>{setRows(null);setError("No se pudo consultar la sede. Verifica permisos.");});},[permitido,uid]);
 const abierta=permitido&&sede.jornadaAbierta===true&&rows!==null;
 const seleccion=rows?.find(p=>p.id===id);
 async function registrar(e){
  e.preventDefault();setMsg("");if(!abierta||auth.currentUser?.uid!==uid)return;setBusy(true);
  try{if(!nombreCompletoValido(form.nombreCompleto))throw new Error("Introduce nombre y apellido.");const d=cedulaVE(form.cedula,form.tipoDocumento),nac=fechaNacimientoISO(form.fechaNacimiento);
   const datos={sedeId:SEDE_CATIA,jornadaId:JORNADA_CATIA,jornadaAnio:2026,cedula:d.cedula,tipoDocumento:d.tipoDocumento,nombreCompleto:nombrePropio(form.nombreCompleto),telefono:telefonoE164VE(form.telefono),fechaNacimiento:nac,edad:edadDesdeFecha(nac),email:correoNormalizado(form.email),localidad:form.localidad.trim(),notas:form.notas.trim(),creadoPor:uid,createdAt:serverTimestamp()};
   await runTransaction(db,async tx=>{const r=refPaciente(JORNADA_CATIA+"-"+d.etiqueta);if((await tx.get(r)).exists())throw new Error("Ya existe un registro con esa cédula en esta jornada.");tx.set(r,datos);});
   setForm(nuevo);setMsg("Paciente registrado y confirmado.");setTab("registro");
  }catch(e){setMsg(e.code?"No se confirmó el registro. Revisa la conexión y los permisos.":e.message);}finally{setBusy(false);}
 }
 return <section className="catia"><header className="cat-card cat-brand"><img src="/branding/zoriapp-2026.svg" alt="ZoriApp"/><PatrocinanteZoriak compact/></header><div className="cat-card"><h1>Hospital Periférico de Catia</h1><p>Dr. Ricardo Baquero González · Jornada 2026</p><button onClick={onLogout}>Cerrar sesión</button></div>
 {(!permitido)?<div className="cat-card"><h2>{perfil===undefined||miembro&&sede===undefined?"Validando acceso…":"Acceso no habilitado"}</h2><p>Requiere cuenta médica afiliada, sede habilitada y conexión al servidor.</p></div>:<>
 <div className="cat-card"><p>{abierta?"Jornada abierta":"Registro cerrado o sin conexión"}</p><nav className="cat-nav">{[["inicio","Inicio"],["registro","Registrar"],["pacientes","Pacientes"]].map(([k,l])=><button key={k} type="button" aria-pressed={tab===k} onClick={()=>{setTab(k);setMsg("");setId("");}}>{l}</button>)}</nav></div>
 {error&&<p role="alert">{error}</p>}
 {tab==="inicio"&&<div className="cat-card"><h2>Indicadores de la sede</h2><p>Meta: {sede.metaPacientes??"Por definir"}</p><p>Registros confirmados: {rows?.length??"Sin conexión"}</p><p>Con tacto registrado: {rows?.filter(p=>p.tacto).length??"—"}</p><p>Con PSA total: {rows?.filter(p=>p.psaTotal!==undefined&&p.psaTotal!==null&&p.psaTotal!=="").length??"—"}</p><p>Esta versión requiere conexión; no almacena expedientes offline.</p></div>}
 {tab==="registro"&&<form className="cat-card" onSubmit={registrar}><h2>Registrar paciente</h2><label>Documento<select value={form.tipoDocumento} onChange={e=>setForm({...form,tipoDocumento:e.target.value})}><option>V</option><option>E</option></select></label>{[["cedula","Cédula","numeric",true],["nombreCompleto","Nombres y apellidos","text",true],["telefono","Teléfono","tel",false],["fechaNacimiento","Nacimiento (DD/MM/AAAA)","text",true],["email","Correo","email",false],["localidad","Localidad","text",false],["notas","Notas","text",false]].map(([k,l,mode,r])=><label key={k}>{l}<input required={r} inputMode={mode} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<button disabled={!abierta||busy}>Guardar paciente</button><p role="status">{msg}</p></form>}
 {tab==="pacientes"&&<div className="cat-card"><h2>Buscar paciente</h2><input aria-label="Buscar paciente" placeholder="Nombre o cédula" value={q} onChange={e=>setQ(e.target.value)}/>{rows?.filter(p=>String(p.nombreCompleto??"").toLowerCase().includes(q.toLowerCase())||String(p.cedula??"").includes(q)).map(p=><button className="cat-patient" key={p.id} onClick={()=>setId(p.id)}>{p.nombreCompleto} · {p.cedula}</button>)}</div>}
 {tab==="pacientes"&&seleccion&&<Evaluacion key={seleccion.id} p={seleccion} uid={uid} abierta={abierta}/>}
 </>}
 </section>;
}
