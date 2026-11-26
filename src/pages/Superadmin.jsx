import {useEffect,useState} from "react";
import {collection,doc,onSnapshot,setDoc,serverTimestamp} from "firebase/firestore";
import {db} from "../firebase";
import {useAuth} from "../context/AuthContext";
const inicial={id:"periferico_catia",nombre:"Hospital Periférico de Catia – Dr. Ricardo Baquero González",jornadaId:"periferico-catia-2026",jornadaAnio:2026,metaPacientes:200,activa:true,jornadaAbierta:false,tarifaUSD:120,renovacionUSD:120};
const roles=["admin_sede","medico","registrador"];
export default function Superadmin(){
 const {user}=useAuth();
 const [sedes,setSedes]=useState([]),[usuarios,setUsuarios]=useState([]);
 const [s,setS]=useState(inicial),[uid,setUid]=useState(""),[sedeId,setSedeId]=useState("periferico_catia"),[rol,setRol]=useState("medico"),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{const fail=()=>setMsg("No se pudo consultar la administración. Revisa las reglas.");const a=onSnapshot(collection(db,"sedes"),x=>setSedes(x.docs.map(d=>({...d.data(),id:d.id}))),fail);const b=onSnapshot(collection(db,"usuarios"),x=>setUsuarios(x.docs.map(d=>({...d.data(),id:d.id}))),fail);return()=>{a();b();};},[]);
 async function action(fn){setBusy(true);setMsg("");try{await fn();setMsg("Cambio confirmado por Firebase.");}catch{setMsg("No se guardó el cambio. Revisa los permisos y los datos.");}finally{setBusy(false);}}
 function guardar(e){e.preventDefault();const {id,...datos}=s; if(!/^[a-z0-9_]+$/.test(id))return setMsg("Código inválido.");action(()=>setDoc(doc(db,"sedes",id),{...datos,actualizadoPor:user.uid,actualizadoEn:serverTimestamp()},{merge:true}));}
 function asignar(e){e.preventDefault();if(!uid.trim()||uid.trim()===user.uid||!sedes.some(x=>x.id===sedeId))return setMsg("Indica un UID de Firebase Authentication y una sede existente.");action(()=>setDoc(doc(db,"usuarios",uid.trim()),{sedeId,rol,activo:true,actualizadoPor:user.uid,actualizadoEn:serverTimestamp()},{merge:true}));}
 return <section style={{maxWidth:900,margin:"auto",padding:"1rem",color:"#17374d"}}>
 <img src="/branding/zoriapp-2026.svg" alt="ZoriApp" width="180"/><h1>Panel central · Superadministrador</h1><p>Gestiona sedes, jornadas y usuarios. Sin consulta de expedientes clínicos.</p>
 <p role="status">{msg}</p>
 <h2>Instituciones ({sedes.length})</h2>{sedes.map(x=><article key={x.id} style={{border:"1px solid #c7ded5",borderRadius:12,padding:12,marginBottom:10}}><strong>{x.nombre}</strong><p>{x.jornadaAnio} · Meta {x.metaPacientes} · USD {x.tarifaUSD} · {x.jornadaAbierta?"Registro abierto":"Registro cerrado"}</p><button disabled={busy} onClick={()=>setS(x)}>Editar</button> <button disabled={busy} onClick={()=>action(()=>setDoc(doc(db,"sedes",x.id),{jornadaAbierta:!x.jornadaAbierta,actualizadoPor:user.uid,actualizadoEn:serverTimestamp()},{merge:true}))}>{x.jornadaAbierta?"Cerrar registro":"Abrir registro"}</button></article>)}
 <button onClick={()=>setS(inicial)}>Preparar Catia</button>
 <form onSubmit={guardar} style={{display:"grid",gap:8,margin:"1rem 0"}}>
 <h2>Configurar sede / jornada</h2>
 {["id","nombre","jornadaId"].map(k=><label key={k}>{k}<input required value={s[k]||""} onChange={e=>setS({...s,[k]:e.target.value})}/></label>)}
 {["jornadaAnio","metaPacientes","tarifaUSD","renovacionUSD"].map(k=><label key={k}>{k}<input type="number" min="0" required value={s[k]} onChange={e=>setS({...s,[k]:Number(e.target.value)})}/></label>)}
 <label><input type="checkbox" checked={s.activa} onChange={e=>setS({...s,activa:e.target.checked})}/> Sede habilitada</label>
 <label><input type="checkbox" checked={s.jornadaAbierta} onChange={e=>setS({...s,jornadaAbierta:e.target.checked})}/> Registro abierto</label>
 <button disabled={busy}>Guardar sede</button></form>
 <form onSubmit={asignar} style={{display:"grid",gap:8}}><h2>Asignar usuario existente</h2><p>Crea primero la cuenta en Firebase Authentication; copia su UID. No introduzcas contraseñas aquí.</p><label>UID <input required value={uid} onChange={e=>setUid(e.target.value)}/></label><label>Sede <select value={sedeId} onChange={e=>setSedeId(e.target.value)}>{sedes.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label><label>Rol <select value={rol} onChange={e=>setRol(e.target.value)}>{roles.map(x=><option key={x}>{x}</option>)}</select></label><button disabled={busy}>Asignar acceso</button></form>
 <h2>Usuarios ({usuarios.length})</h2>{usuarios.filter(x=>x.rol!=="superadmin").map(x=><article key={x.id} style={{padding:8,borderBottom:"1px solid #ddd",overflowWrap:"anywhere"}}><strong>{x.id}</strong><p>{x.sedeId} · {x.rol} · {x.activo?"Activo":"Suspendido"}</p><button disabled={busy} onClick={()=>action(()=>setDoc(doc(db,"usuarios",x.id),{activo:!x.activo,actualizadoPor:user.uid,actualizadoEn:serverTimestamp()},{merge:true}))}>{x.activo?"Suspender":"Habilitar"}</button></article>)}
 </section>;
}
