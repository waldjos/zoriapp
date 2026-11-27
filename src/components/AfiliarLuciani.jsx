import {useState} from "react";
import {doc,runTransaction,serverTimestamp} from "firebase/firestore";
import {db,auth} from "../firebase";
import {normalizarUids} from "../utils/afiliacionLuciani";
export default function AfiliarLuciani({uid,sedeId="domingo_luciani"}){
 const catia=sedeId==="periferico_catia";
 const nombre=catia?"Periférico de Catia":"Domingo Luciani";
 const [texto,setTexto]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function asignar(e){
  e.preventDefault();setMsg("");
  if(!["domingo_luciani","periferico_catia"].includes(sedeId)){setMsg("Sede no autorizada.");return;}
  let ids;
  try{ids=normalizarUids(texto,uid);}catch(err){setMsg(err.message);return;}
  if(auth.currentUser?.uid!==uid){setMsg("La sesión cambió. Ingresa de nuevo.");return;}
  if(!window.confirm("Registrar perfiles de "+ids.length+" cuentas existentes de "+nombre+". No se crean cuentas ni se modifican expedientes."))return;
  setBusy(true);
  try{
   const resultado=await runTransaction(db,async tx=>{
    const refs=ids.map(id=>doc(db,"usuarios",id));
    const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
    const conflict=snaps.some(s=>s.exists()&&(s.data().sedeId!==sedeId||s.data().rol!=="medico"||s.data().activo!==true));
    if(conflict)throw new Error("perfil-conflicto");
    let nuevos=0;
    snaps.forEach((s,i)=>{if(!s.exists()){tx.set(refs[i],{sedeId,rol:"medico",activo:true,creadoPor:uid,creadoEn:serverTimestamp()});nuevos++;}});
    return {nuevos,existentes:ids.length-nuevos};
   });
   setMsg("Perfiles creados: "+resultado.nuevos+". Ya existentes: "+resultado.existentes+". No se modificaron expedientes.");setTexto("");
  }catch(e){setMsg(e.message==="perfil-conflicto"?"Existe un perfil con otra configuración. No se guardó ningún cambio.":"No se pudo registrar el lote. Verifica reglas y conexión.");}
  finally{setBusy(false);}
 }
 return <form className="zc-site" onSubmit={asignar}><h2>Afiliar médicos existentes · {nombre}</h2><p>Pega los UID verificados de Firebase Authentication, uno por línea. Esta operación solo crea perfiles faltantes y no cambia el acceso clínico actual. Requiere las reglas de afiliación aprobadas.</p><label>UID de médicos<textarea rows={6} value={texto} onChange={e=>setTexto(e.target.value)} required disabled={busy} autoComplete="off" spellCheck={false}/></label><button type="submit" disabled={busy}>{busy?"Guardando…":"Registrar perfiles"}</button><p role="status">{msg}</p></form>;
}
