import {useState} from "react";
import {doc,collection,getDocFromServer,getDocsFromServer} from "../utils/backendJornada";
import {auth,db} from "../firebase";
import {rutaCatia,SEDE_CATIA,perfilCatia,sedeCatia} from "../utils/catia";
import {esFichaCatia,fichaFilas,resumenCatia} from "../utils/reportesCatia";
import ZoriIcon from "./ZoriIcon";
const nombre="Hospital Periférico de Catia";
async function autorizar(uid){
 if(auth.currentUser?.uid!==uid)throw new Error("Sesión no disponible.");
 const [p,s]=await Promise.all([getDocFromServer(doc(db,"usuarios",uid)),getDocFromServer(doc(db,"sedes",SEDE_CATIA))]);
 if(auth.currentUser?.uid!==uid||!perfilCatia(p.data())||!sedeCatia(s.data()))throw new Error("Acceso no autorizado.");
}
const fecha=()=>new Date().toLocaleString("es-VE",{timeZone:"America/Caracas"});
export function FichaCatia({p,uid}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function pdf(){
  if(!window.confirm("El PDF contiene datos clínicos confidenciales. Descárgalo únicamente en un dispositivo autorizado y para fines asistenciales."))return;
  setBusy(true);setError("");
  try{
   await autorizar(uid);
   const s=await getDocFromServer(doc(db,...rutaCatia(),p.id));
   if(!s.exists()||!esFichaCatia(s.data()))throw new Error("Expediente no disponible.");
   const [{jsPDF},{default:autoTable}]=await Promise.all([import("jspdf"),import("jspdf-autotable")]);
   await autorizar(uid);
   const d=new jsPDF({unit:"mm",format:"a4"});
   d.setTextColor(8,119,94);d.setFontSize(18);d.text("ZoriApp | Ficha clínica",14,17);
   d.setFontSize(11);d.text(nombre,14,25);d.text("Dr. Ricardo Baquero González · Jornada 2026",14,31);
   d.setTextColor(80);d.setFontSize(9);d.text("Confidencial · Datos registrados · "+fecha(),14,38);
   autoTable(d,{startY:43,head:[["Sección","Campo","Valor"]],body:fichaFilas(s.data()),styles:{fontSize:9,overflow:"linebreak"},headStyles:{fillColor:[8,119,94]},columnStyles:{0:{cellWidth:38},1:{cellWidth:53}},margin:{bottom:18},didDrawPage:()=>{d.setFontSize(8);d.text("Confidencial · No constituye diagnóstico ni informe firmado.",14,286);}});
   d.save("ZoriApp-Catia-ficha.pdf");
  }catch{setError("No se pudo generar la ficha. Comprueba conexión y autorización.");}finally{setBusy(false);}
 }
 if(!esFichaCatia(p))return null;
 return <section className="cat-card cat-ficha"><h2>Ficha clínica</h2><p>Datos confirmados en Firebase · Jornada 2026</p>{["Datos del paciente","Tacto rectal","Laboratorio"].map(g=><div key={g}><h3>{g}</h3><dl>{fichaFilas(p).filter(x=>x[0]===g).map(([,k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>)}<button type="button" disabled={busy} onClick={pdf}>{busy?"Generando…":"Descargar ficha PDF"}</button><p role="status">{error}</p></section>;
}
export function IndicadoresCatia({rows,uid}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const r=resumenCatia(rows??[]);
 const items=[["Pacientes registrados",r.total],["Tacto registrado",r.tacto],["PSA total registrado",r.psa],["PSA libre registrado",r.libre],["Con tacto y PSA",r.ambos],["Pendientes de tacto o PSA",r.pendientes]];
 async function excel(){
  setBusy(true);setError("");
  try{
   await autorizar(uid);
   const snap=await getDocsFromServer(collection(db,...rutaCatia()));
   const x=resumenCatia(snap.docs.map(d=>d.data()));
   const XLSX=await import("xlsx");
   await autorizar(uid);
   const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([["ZoriApp - "+nombre],["Jornada",2026],["Generado",fecha()],["Indicador","Cantidad"],["Pacientes registrados",x.total],["Tacto registrado",x.tacto],["PSA total registrado",x.psa],["PSA libre registrado",x.libre],["Con tacto y PSA",x.ambos],["Pendientes de tacto o PSA",x.pendientes]]);
   ws["!cols"]=[{wch:52},{wch:24}];XLSX.utils.book_append_sheet(wb,ws,"Indicadores Catia");XLSX.writeFile(wb,"ZoriApp-Catia-indicadores.xlsx");
  }catch{setError("No se pudo exportar. Comprueba conexión y autorización.");}finally{setBusy(false);}
 }
 return <section className="cat-card cat-reportes"><h2>Estadísticas de cobertura</h2>{items.map(([l,n])=><div key={l} className="cat-stat"><span>{l}</span><strong>{rows===null?"—":n}</strong><progress max={Math.max(r.total,1)} value={n}/></div>)}<button type="button" disabled={busy||rows===null} onClick={excel}><ZoriIcon name="ficha-paciente" size={18}/> {busy?"Generando…":"Exportar indicadores Excel"}</button><small>Reporte agregado, sin nombres ni cédulas.</small><p role="status">{error}</p></section>;
}
