import {useEffect,useState} from "react";
import {collection,doc,onSnapshot,runTransaction,serverTimestamp} from "../utils/backendJornada";
import {enContingencia} from "../utils/backendJornada";
import {db,auth} from "../firebase";
import {useAuth} from "../context/AuthContext";
import ZoriIcon from "../components/ZoriIcon";
import CedulaOCR from "../components/CedulaOCR";
import EstadoCatiaOffline from "../components/EstadoCatiaOffline";
import {guardarPacienteLocal} from "../utils/colaCatiaOffline";
import {capturaVigente,validarColaCatia} from "../utils/syncCatiaCore";
import {FichaCatia,IndicadoresCatia} from "../components/ReportesCatia";
import {esFichaCatia} from "../utils/reportesCatia";
import {PatrocinanteZoriak} from "../components/IdentidadJornada";
import {cedulaVE,nombrePropio,nombrePropioEnEdicion,mascaraFechaRapida,nombreCompletoValido,telefonoE164VE,fechaNacimientoISO,edadDesdeFecha,correoNormalizado} from "../utils/registroExpress";
import {SEDE_CATIA,JORNADA_CATIA,rutaCatia,perfilCatia,sedeCatia,valorPSA,fichaCatiaVacia,fichaDesdeOCR} from "../utils/catia";
import "./Catia.css";
const tactoInicial={tamanio:"",fibroelastica:false,aumentadaConsistencia:false,petrea:false,bordes:"",nodulos:"",ladoNodulo:"",planosClivaje:""};
const nuevo=fichaCatiaVacia();
const refPaciente=id=>doc(db,...rutaCatia(),id);
function Evaluacion({p,uid,abierta,seccion}){
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
   await runTransaction(db,async tx=>{const ref=refPaciente(p.id);if(!(await tx.get(ref)).exists())throw new Error("El expediente ya no está disponible.");tx.update(ref,datos);});setMsg("Guardado y confirmado por Firebase.");
  }catch(e){setMsg(e.code?"No se confirmó el guardado. Revisa conexión y permisos.":e.message);}finally{setBusy(false);}
 }
 return <div className="cat-card"><h2>Evaluación clínica</h2><p><strong>{p.nombreCompleto}</strong> · {p.tipoDocumento}-{p.cedula}</p>
 {seccion!=="psa"&&<form onSubmit={e=>guardar(e,"tacto")}><h3>Tacto rectal</h3>
 { [["tamanio","Tamaño",["I","II","III"]],["bordes","Bordes",["regulares","irregulares"]],["nodulos","Nódulos",["si","no"]],["planosClivaje","Planos de clivaje",["si","no"]]].map(([k,l,opts])=><label key={k}>{l}<select required value={t[k]} onChange={e=>put(k,e.target.value)}><option value="">Seleccionar</option>{opts.map(x=><option key={x}>{x}</option>)}</select></label>)}
 {t.nodulos==="si"&&<label>Lado del nódulo<select required value={t.ladoNodulo} onChange={e=>put("ladoNodulo",e.target.value)}><option value="">Seleccionar</option><option>derecho</option><option>izquierdo</option><option>bilateral</option></select></label>}
 <fieldset><legend>Consistencia</legend>{[["fibroelastica","Fibroelástica"],["aumentadaConsistencia","Aumentada"],["petrea","Pétrea"]].map(([k,l])=><label className="cat-check" key={k}><input type="checkbox" checked={!!t[k]} onChange={e=>put(k,e.target.checked)}/>{l}</label>)}</fieldset>
 <button disabled={busy||!abierta}>Guardar evaluación</button></form>}
 {seccion!=="tacto"&&<form onSubmit={e=>guardar(e,"psa")}><h3>Laboratorio y PSA (ng/mL)</h3><label>PSA total<input inputMode="decimal" required value={total} onChange={e=>setTotal(e.target.value)}/></label><label>PSA libre<input inputMode="decimal" value={libre} onChange={e=>setLibre(e.target.value)}/></label><button disabled={busy||!abierta}>Guardar valores PSA</button></form>}<p role="status">{msg}</p>
 <p>Los valores registrados no constituyen por sí solos un diagnóstico.</p></div>;
}
export default function Catia({onLogout}){
 const {user}=useAuth(),uid=user?.uid;
 const [perfil,setPerfil]=useState(undefined),[sede,setSede]=useState(undefined),[rows,setRows]=useState(null),[error,setError]=useState(""),[tab,setTab]=useState("inicio"),[q,setQ]=useState(""),[id,setId]=useState(""),[form,setForm]=useState(nuevo),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const [recargarLista,setRecargarLista]=useState(0);
 const [perfilServidor,setPerfilServidor]=useState(false),[sedeServidor,setSedeServidor]=useState(false),[preparada,setPreparada]=useState(false),[confirmada,setConfirmada]=useState(null),[reloj,setReloj]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setReloj(Date.now()),15000);return()=>clearInterval(t);},[]);
 useEffect(()=>onSnapshot(doc(db,"usuarios",uid),{includeMetadataChanges:true},s=>{const ok=!s.metadata.fromCache&&!s.metadata.hasPendingWrites;setPerfilServidor(ok);if(ok)setPerfil(s.data()??null);},()=>{setPerfilServidor(false);setPerfil(null);setConfirmada(null);}),[uid]);
 const [verificado,setVerificado]=useState(false),[ocrBusy,setOcrBusy]=useState(false);
 const miembro=perfilCatia(perfil);
 useEffect(()=>{setSede(undefined);setSedeServidor(false);if(!miembro){setConfirmada(null);return;}return onSnapshot(doc(db,"sedes",SEDE_CATIA),{includeMetadataChanges:true},s=>{const ok=!s.metadata.fromCache&&!s.metadata.hasPendingWrites;setSedeServidor(ok);if(ok){setSede(s.data()??null);if(s.data()?.jornadaAbierta!==true||!sedeCatia(s.data()))setConfirmada(null);}},()=>{setSedeServidor(false);setSede(null);setConfirmada(null);});},[miembro,uid]);
 const permitido=miembro&&sedeCatia(sede);
 useEffect(()=>{setRows(null);setError("");if(!permitido)return;return onSnapshot(collection(db,...rutaCatia()),{includeMetadataChanges:true},s=>{if(s.metadata.fromCache){setRows(null);setError("Sin conexión confirmada. Vuelve a conectarte.");return;}if(s.metadata.hasPendingWrites)return;setRows(s.docs.map(d=>({...d.data(),id:d.id})).filter(esFichaCatia));setError("");},()=>{setRows(null);setError("No se pudo consultar la sede. Verifica permisos.");});},[permitido,uid,recargarLista]);
 const enServidor=permitido&&perfilServidor&&sedeServidor&&rows!==null;
 const abierta=enServidor&&sede.jornadaAbierta===true;
 useEffect(()=>{if(abierta)setConfirmada(Date.now());},[abierta]);
 const capturaLocal=!enContingencia()&&permitido&&sede.jornadaAbierta===true&&preparada&&capturaVigente(confirmada,reloj)&&!enServidor;
 const puedeRegistrar=abierta||capturaLocal;
 const visibles=enServidor?rows:null;
 useEffect(()=>{if(!permitido||tab!=="registro")setOcrBusy(false);},[permitido,tab]);
 const cambiar=(k,v)=>{setForm(f=>({...f,[k]:v}));setVerificado(false);};
 const recibirOCR=lectura=>{setForm(fichaDesdeOCR(lectura));setVerificado(false);setMsg("");};
 let edadVista=null;try{edadVista=edadDesdeFecha(fechaNacimientoISO(form.fechaNacimiento));}catch{}
 const ir=k=>{setTab(k);setMsg("");setId("");setQ("");window.scrollTo(0,0);};
 const buscar=["pacientes","tacto","psa"].includes(tab);
 const acciones=[["inicio","Inicio","inicio"],["registro","Registrar","registrar-paciente"],["pacientes","Pacientes","pacientes"],["tacto","Tacto","evaluacion"],["psa","PSA","laboratorio"]];
 const seleccion=visibles?.find(p=>p.id===id);
 async function registrar(e){
  e.preventDefault();setMsg("");if(!puedeRegistrar||ocrBusy||auth.currentUser?.uid!==uid)return;setBusy(true);
  try{if(!verificado)throw new Error("Confirma que revisaste los datos de la cédula.");if(!nombreCompletoValido(form.nombreCompleto))throw new Error("Introduce nombre y apellido.");const d=cedulaVE(form.cedula,form.tipoDocumento),nac=fechaNacimientoISO(form.fechaNacimiento);
   const edad=edadDesdeFecha(nac);if(!nac||!Number.isInteger(edad)||edad<0||edad>150)throw new Error("Introduce una fecha de nacimiento válida.");
   const datos={sedeId:SEDE_CATIA,jornadaId:JORNADA_CATIA,jornadaAnio:2026,cedula:d.cedula,tipoDocumento:d.tipoDocumento,nombreCompleto:nombrePropio(form.nombreCompleto),telefono:telefonoE164VE(form.telefono),fechaNacimiento:nac,edad,email:correoNormalizado(form.email),localidad:form.localidad.trim(),notas:form.notas.trim(),creadoPor:uid};
   validarColaCatia(datos,uid);
   if(capturaLocal&&!abierta){await guardarPacienteLocal(datos,uid);setMsg("Ficha cifrada guardada en este teléfono; pendiente de confirmación.");}
   else {await runTransaction(db,async tx=>{const r=refPaciente(JORNADA_CATIA+"-"+d.etiqueta);if((await tx.get(r)).exists())throw new Error("Ya existe un registro con esa cédula en esta jornada.");tx.set(r,{...datos,createdAt:serverTimestamp()});});setMsg("Paciente registrado y confirmado.");}
   setForm(fichaCatiaVacia());setVerificado(false);setTab("registro");
  }catch(e){const codigo=String(e?.code??"").replace(/^firestore\//,"");const mensajes={"permission-denied":"Firebase rechazó el registro por permisos (permission-denied).","unavailable":"No se confirmó el registro: Firebase no está disponible (unavailable).","deadline-exceeded":"No se confirmó el registro: tiempo de espera agotado (deadline-exceeded).","unauthenticated":"Firebase requiere iniciar sesión nuevamente (unauthenticated).","resource-exhausted":"Firebase alcanzó un límite de servicio (resource-exhausted).","failed-precondition":"Firebase no cumplió una condición de escritura (failed-precondition).","aborted":"La transacción se interrumpió (aborted)."};setMsg(codigo?(mensajes[codigo]||"No se confirmó el registro. Código: "+( /^[a-z-]{1,50}$/.test(codigo)?codigo:"desconocido")):e.message);}finally{setBusy(false);}
 }
 return <section className="catia"><header className="cat-card cat-brand"><img src="/branding/zoriapp-2026.svg" alt="ZoriApp"/><PatrocinanteZoriak compact/></header><div className="cat-card cat-institution"><div className="cat-institution-title"><img className="cat-hospital-logo" src="/branding/hospital-periferico-catia.webp" alt="Emblema del Hospital Periférico de Catia" width="80" height="80"/><div><span className="cat-kicker">Jornada urológica 2026</span><h1>Hospital Periférico de Catia</h1><p>Dr. Ricardo Baquero González</p></div></div><div className="cat-user"><span>{user.email}</span><button onClick={onLogout}><ZoriIcon name="cerrar-sesion" size={18}/> Salir</button></div></div>
 {(!permitido)?<div className="cat-card"><h2>{perfil===undefined||miembro&&sede===undefined?"Validando acceso…":"Acceso no habilitado"}</h2><p>Requiere cuenta médica afiliada, sede habilitada y conexión al servidor.</p></div>:<>
 <div className={"cat-state "+(abierta?"cat-open":"cat-closed")} role="status"><ZoriIcon name="seguridad" size={20}/>{abierta?"Jornada abierta · conexión confirmada":sede.jornadaAbierta!==true?"Jornada cerrada · modo consulta":capturaLocal?"Sin conexión · captura local pendiente de envío":"Sin conexión confirmada"}</div><nav className="cat-bottom" aria-label="Navegación Catia">{acciones.map(([k,l,ic])=><button key={k} type="button" aria-pressed={tab===k} onClick={()=>ir(k)}><ZoriIcon name={ic} size={24}/><span>{l}</span></button>)}</nav>
 {error&&<p role="alert">{error}</p>}
 {enContingencia()?<p className="cat-card cat-note">Contingencia: datos confirmados en Realtime Database. Histórico no disponible; las fichas offline anteriores se conservan en el dispositivo.</p>:<EstadoCatiaOffline uid={uid} abierta={abierta} preparada={preparada} habilitar={setPreparada}/>}
 {tab==="inicio"&&<><div className="cat-card"><h2>Indicadores de la jornada</h2><div className="cat-metrics">{[["Meta",sede.metaPacientes??"—"],["Registrados",visibles?.length??"—"],["Con tacto",visibles?.filter(p=>p.tacto).length??"—"],["Con PSA",visibles?.filter(p=>p.psaTotal!==undefined&&p.psaTotal!==null&&p.psaTotal!=="").length??"—"]].map(([l,n])=><div key={l}><span>{l}</span><strong>{n}</strong></div>)}</div>{visibles&&sede.metaPacientes>0&&<><progress max={sede.metaPacientes} value={Math.min(visibles.length,sede.metaPacientes)}/><small>{visibles.length} de {sede.metaPacientes} pacientes</small></>}</div><div className="cat-card"><h2>Accesos rápidos</h2><div className="cat-actions">{acciones.filter(([k])=>k!=="inicio").map(([k,l,ic])=><button key={k} onClick={()=>ir(k)}><ZoriIcon name={ic}/>{l}</button>)}</div><p className="cat-note">{enContingencia()?"Durante la contingencia se requiere conexión. Los indicadores corresponden únicamente a las fichas de contingencia.":"La captura sin conexión requiere preparación y una jornada abierta confirmada en esta sesión. Consulta, tacto y PSA requieren internet."}</p></div></>}
 {tab==="inicio"&&<IndicadoresCatia rows={visibles} uid={uid}/>}
 {tab==="registro"&&<form className="cat-card cat-registro zori-registro" onSubmit={registrar}><h2>Registro de paciente</h2><p>Escanea la cédula o completa los datos manualmente. Una nueva lectura sustituye la ficha en edición.</p>
 <CedulaOCR disabled={busy} onExtract={recibirOCR} onBusyChange={v=>{setOcrBusy(v);if(v)setVerificado(false);}}/>
 <p className="zori-registro-step">2. Confirmar datos del paciente</p>
 <fieldset disabled={busy||ocrBusy} className="cat-form-fields">
 <label>Nombre completo *<input autoCapitalize="words" autoComplete="off" required maxLength={200} placeholder="Nombres y apellidos" value={form.nombreCompleto} onChange={e=>cambiar("nombreCompleto",nombrePropioEnEdicion(e.target.value))} onBlur={()=>setForm(f=>({...f,nombreCompleto:nombrePropio(f.nombreCompleto)}))}/></label>
 <div className="cat-doc-row"><label>Tipo<select value={form.tipoDocumento} onChange={e=>cambiar("tipoDocumento",e.target.value)}><option>V</option><option>E</option></select></label><label>Cédula / Documento *<input required inputMode="numeric" maxLength={9} placeholder="12345678" value={form.cedula} onChange={e=>cambiar("cedula",e.target.value.replace(/\D/g,"").slice(0,9))}/></label></div>
 <label>Teléfono<input type="tel" inputMode="tel" maxLength={25} placeholder="0412-123.45.67" value={form.telefono} onChange={e=>cambiar("telefono",e.target.value)} onBlur={()=>{try{setForm(f=>({...f,telefono:telefonoE164VE(f.telefono)}));}catch{}}}/><small>Se normaliza a +58.</small></label>
 <label>Correo electrónico<input type="email" maxLength={254} value={form.email} onChange={e=>cambiar("email",e.target.value)}/></label>
 <label>Localidad<input maxLength={300} value={form.localidad} onChange={e=>cambiar("localidad",e.target.value)} placeholder="Ciudad / Estado"/></label>
 <label>Fecha de nacimiento (DD/MM/AAAA) *<input required inputMode="numeric" maxLength={10} placeholder="DD/MM/AAAA" value={form.fechaNacimiento} onChange={e=>cambiar("fechaNacimiento",mascaraFechaRapida(e.target.value))}/></label>
 <label>Edad (calculada automáticamente)<input readOnly value={edadVista??""}/></label>
 <label>Notas (motivo, hallazgos, etc.)<textarea rows={3} maxLength={2000} value={form.notas} onChange={e=>cambiar("notas",e.target.value)}/></label>
 <label className="zori-confirmacion-cedula"><input type="checkbox" checked={verificado} onChange={e=>setVerificado(e.target.checked)} required/><span><strong>He revisado los datos de la cédula.</strong><small>Comprueba nombres, apellidos, número y fecha de nacimiento antes de guardar.</small></span></label>
 </fieldset><button type="submit" disabled={!puedeRegistrar||busy||ocrBusy||!verificado}>{busy?"Guardando…":"Guardar ficha del paciente"}</button><p role="status">{msg}</p>{!puedeRegistrar&&<small>Registro bloqueado. Jornada cerrada o falta preparación/conexión.</small>}</form>}
 {buscar&&<div className="cat-card"><button type="button" onClick={()=>setRecargarLista(x=>x+1)}>Actualizar pacientes</button><h2>{tab==="tacto"?"Buscar paciente para tacto":tab==="psa"?"Buscar paciente para PSA":"Buscar paciente"}</h2>{visibles?.length===0&&<p>Aún no hay pacientes registrados.</p>}<input aria-label="Buscar paciente" placeholder="Nombre o cédula" value={q} onChange={e=>setQ(e.target.value)}/>{visibles?.filter(p=>String(p.nombreCompleto??"").toLowerCase().includes(q.toLowerCase())||String(p.cedula??"").includes(q)).map(p=><button className="cat-patient" key={p.id} onClick={()=>setId(p.id)}>{p.nombreCompleto} · {p.cedula}</button>)}</div>}
 {tab==="pacientes"&&seleccion&&<FichaCatia key={seleccion.id} p={seleccion} uid={uid}/>}
 {buscar&&seleccion&&<Evaluacion key={tab+":"+seleccion.id} p={seleccion} uid={uid} abierta={abierta} seccion={tab}/>}
 </>}
 </section>;
}
