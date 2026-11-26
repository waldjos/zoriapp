import {useEffect,useState} from "react";
import {collection,getDocsFromServer} from "firebase/firestore";
import {Link} from "react-router-dom";
import {db} from "../firebase";
import {useAuth} from "../context/AuthContext";
import {usePanelCentral} from "../utils/usePanelCentral";
import "./PanelCentral.css";
import AfiliarLuciani from "../components/AfiliarLuciani";
const num=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const formato=v=>num(v)===null?"Por definir":new Intl.NumberFormat("es-VE").format(v);
const dinero=v=>num(v)===null?"Por definir":"USD "+formato(v);
const suma=(rows,k)=>rows.every(r=>num(r[k])!==null)?rows.reduce((n,r)=>n+r[k],0):null;
export default function PanelCentral(){
 const {user}=useAuth(),{autorizado,cargando}=usePanelCentral();
 const [resultado,setResultado]=useState(null),[error,setError]=useState(""),[version,setVersion]=useState(0);
 const uid=user?.uid;
 useEffect(()=>{
  let vivo=true;setResultado(null);setError("");
  if(autorizado&&uid){
   getDocsFromServer(collection(db,"sedes")).then(snap=>{if(vivo)setResultado({uid,sedes:snap.docs.map(d=>({...d.data(),id:d.id}))});}).catch(()=>{if(vivo)setError("No se pudo consultar el registro de sedes. Revisa la conexión y los permisos de Firebase.");});
  }
  return ()=>{vivo=false;};
 },[autorizado,uid,version]);
 if(cargando)return <section className="zc-panel"><p role="status">Verificando privilegios…</p></section>;
 if(!autorizado)return <section className="zc-panel"><h1>Acceso restringido</h1><p>El panel requiere el perfil administrativo activo y conexión a Firebase.</p><Link to="/">Volver al inicio</Link></section>;
 const rows=resultado?.uid===uid?resultado.sedes:null;
 return <section className="zc-panel">
 <header><img src="/branding/zoriapp-2026.svg" alt="ZoriApp" width="190"/><span>Administración central</span></header>
 <h1>Panel de Superadministrador</h1><p>Consulta institucional · etapa de transición.</p>
 <p className="zc-note">Consulta de sedes y preparación de perfiles del personal existente. No modifica pacientes ni jornadas. Las tarifas son configuradas, no cobros confirmados.</p>
 <button type="button" onClick={()=>setVersion(v=>v+1)}>Actualizar sedes</button> <Link to="/">Volver a la aplicación actual</Link>
 {error&&<p role="alert">{error}</p>}
 {!rows&&!error&&<p role="status">Consultando sedes…</p>}
 {rows&&<><div className="zc-grid">
 {[[rows.length,"Sedes registradas"],[formato(suma(rows,"metaPacientes")),"Meta de pacientes"],[dinero(suma(rows,"tarifaUSD")),"Tarifas por jornada"],[dinero(suma(rows,"renovacionUSD")),"Renovaciones previstas"]].map(([v,k])=><article key={k}><span>{k}</span><strong>{v}</strong></article>)}
 </div><h2>Instituciones</h2>{rows.map(s=><article className="zc-site" key={s.id}><span className="zc-status">{s.activa===true?"Sede habilitada":"Sede no habilitada"}</span><h3>{typeof s.nombre==="string"?s.nombre:s.id}</h3><dl><dt>Jornada</dt><dd>{formato(s.jornadaAnio)} · {s.jornadaAbierta===true?"Abierta":"Cerrada"}</dd><dt>Meta</dt><dd>{formato(s.metaPacientes)}</dd><dt>Tarifa</dt><dd>{dinero(s.tarifaUSD)}</dd><dt>Renovación</dt><dd>{dinero(s.renovacionUSD)}</dd></dl></article>)}</>}
 {rows?.some(s=>s.id==="domingo_luciani") && <AfiliarLuciani key={uid} uid={uid}/>}
 <p>Las nuevas sedes permanecen cerradas hasta aprobar las reglas definitivas y las pruebas de aislamiento.</p>
 </section>;
}
