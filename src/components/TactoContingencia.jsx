import {useEffect,useState,useRef} from "react";
import {ref,get,set,push,serverTimestamp} from "firebase/database";
import {dbContingencia as db} from "../utils/accesoContingencia";
import {auth} from "../firebase";
import {tactoInicial,validarTacto} from "../utils/tactoContingencia";
export default function TactoContingencia({paciente,sedeId,uid,permitido,soloConsulta=false,onBusy}){
 const [t,setT]=useState(tactoInicial),[hist,setHist]=useState(null),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[reintento,setReintento]=useState(0);
 const pendiente=useRef(null),vivo=useRef(true);
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false};},[]);
 const id=paciente.tipoDocumento+"-"+paciente.cedula;
 const ruta=ref(db,"contingencia/tactos/"+sedeId+"/"+id);
 useEffect(()=>{let activo=true;if(!permitido){setHist(null);return;}get(ruta).then(s=>{if(activo){setHist(s.val()||{});setMsg("");}}).catch(()=>{if(activo){setHist(null);setMsg("No se pudo consultar el tacto. Comprueba la conexión y la publicación de las normas.");}});return()=>{activo=false;};},[sedeId,id,permitido,reintento]);
 const put=(k,v)=>setT(x=>({...x,[k]:v}));
 async function guardar(e){e.preventDefault();if(!permitido||busy||soloConsulta||hist===null||auth.currentUser?.uid!==uid)return;
 setBusy(true);onBusy?.(true);setMsg("");
 try{
  const datos=validarTacto(t,uid);
  const clave=pendiente.current?.clave||push(ruta).key;
  const prev=pendiente.current;
  if(prev&&JSON.stringify(prev.datos)!==JSON.stringify(datos))throw Error("Hay un envío anterior sin confirmar. Conserva esos hallazgos y reintenta antes de modificarlos.");
  pendiente.current={clave,datos};
  const destino=ref(db,"contingencia/tactos/"+sedeId+"/"+id+"/"+clave);
  // Si el servidor ya confirmó el intento anterior, no crear otra evaluación.
  const existe=await get(destino);
  if(existe.exists()){
   const guardado=existe.val();
   if(!Object.entries(datos).every(([k,v])=>guardado[k]===v))throw Error("Conflicto de evaluación. Solicita revisión.");
  }else await set(destino,{...datos,actualizadoEn:serverTimestamp()});
  if(vivo.current){pendiente.current=null;setT(tactoInicial());setMsg("Evaluación de tacto guardada y confirmada.");try{const s=await get(ruta);setHist(s.val()||{});}catch{setHist(null);}}
 }catch(e){if(vivo.current)setMsg(e?.code?"No se confirmó la evaluación. Reintenta sin cambiar los hallazgos.":e.message);}
 finally{if(vivo.current)setBusy(false);onBusy?.(false);}
 }
 const items=Object.values(hist||{}).sort((a,b)=>b.actualizadoEn-a.actualizadoEn);
 return <section className="cat-card cat-ficha"><h2>Evaluación de tacto rectal</h2><p><strong>{paciente.nombreCompleto}</strong> · {id}</p>
 {hist===null?<button type="button" disabled={!permitido||busy} onClick={()=>setReintento(x=>x+1)}>Consultar evaluaciones</button>:<p>{items.length===0?"Sin evaluación registrada":items.length+" evaluación(es) confirmada(s)"}</p>}
 {items.map((a,i)=><div key={i}><h3>{new Date(a.actualizadoEn).toLocaleString("es-VE",{timeZone:"America/Caracas"})}</h3><dl>{[["Tamaño",a.tamanio],["Consistencia",[a.fibroelastica&&"Fibroelástica",a.aumentadaConsistencia&&"Aumentada",a.petrea&&"Pétrea"].filter(Boolean).join(", ")],["Bordes",a.bordes],["Nódulos",a.nodulos==="si"?"Sí":"No"],["Lado",a.ladoNodulo||"No aplica"],["Planos de clivaje",a.planosClivaje==="si"?"Sí":"No"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>)}
 {!soloConsulta&&<form onSubmit={guardar}><h3>{items.length?"Nueva evaluación (conserva las anteriores)":"Registrar hallazgos"}</h3><fieldset disabled={busy||!permitido||!!pendiente.current} className="cat-form-fields">{[["tamanio","Tamaño",["I","II","III"]],["bordes","Bordes",["regulares","irregulares"]],["nodulos","Nódulos",["si","no"]],["planosClivaje","Planos de clivaje",["si","no"]]].map(([k,l,opts])=><label key={k}>{l}<select required value={t[k]} onChange={e=>put(k,e.target.value)}><option value="">Seleccionar</option>{opts.map(x=><option key={x}>{x}</option>)}</select></label>)}
 {t.nodulos==="si"&&<label>Lado del nódulo<select required value={t.ladoNodulo} onChange={e=>put("ladoNodulo",e.target.value)}><option value="">Seleccionar</option>{["derecho","izquierdo","bilateral"].map(x=><option key={x}>{x}</option>)}</select></label>}
 <fieldset><legend>Consistencia</legend>{[["fibroelastica","Fibroelástica"],["aumentadaConsistencia","Aumentada de consistencia"],["petrea","Pétrea"]].map(([k,l])=><label className="cat-check" key={k}><input type="checkbox" checked={t[k]} onChange={e=>put(k,e.target.checked)}/>{l}</label>)}</fieldset></fieldset><button disabled={busy||!permitido||hist===null}>{busy?"Confirmando…":pendiente.current?"Reintentar guardado":"Guardar evaluación"}</button></form>}
 <p role="status">{msg}</p></section>;
}
