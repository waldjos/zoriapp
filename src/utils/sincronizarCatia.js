import {doc,runTransaction,serverTimestamp} from "firebase/firestore";
import {auth,db} from "../firebase";
import {rutaCatia,perfilCatia,sedeCatia,SEDE_CATIA} from "./catia";
import {validarColaCatia,registroCoincide} from "./syncCatiaCore";
import {pendientesLocales,confirmarSincronizacion} from "./colaCatiaOffline";
export async function sincronizarCatia(uid){
 if(!uid||auth.currentUser?.uid!==uid||!navigator.onLine) return {enviados:0,error:"Sin conexión o sesión no disponible."};
 if(!navigator.locks?.request)throw new Error("Sincronización segura no disponible.");
 return navigator.locks.request("zoriapp-catia-sync-"+uid,{ifAvailable:true},async lock=>{
  if(!lock)return {enviados:0,error:"Otra pestaña está sincronizando."};
  let enviados=0,conflictos=0;
  for(const r of await pendientesLocales(uid)){
   if(auth.currentUser?.uid!==uid||!navigator.onLine)return {enviados,error:"Sesión o conexión interrumpida."};
   if(!r.datos)return {enviados,error:"Ficha cifrada requiere revisión. No borres datos del navegador."};
   try{
    const id=validarColaCatia(r.datos,uid);
    const estado=await runTransaction(db,async tx=>{
     if(auth.currentUser?.uid!==uid)throw new Error("Sesión cambiada.");
     const [p,s,paciente]=await Promise.all([tx.get(doc(db,"usuarios",uid)),tx.get(doc(db,"sedes",SEDE_CATIA)),tx.get(doc(db,...rutaCatia(),id))]);
     if(auth.currentUser?.uid!==uid||!perfilCatia(p.data())||!sedeCatia(s.data())||s.data().jornadaAbierta!==true)throw new Error("Jornada no autorizada.");
     if(paciente.exists())return registroCoincide(paciente.data(),r.datos)?"confirmado":"conflicto";
     tx.set(doc(db,...rutaCatia(),id),{...r.datos,createdAt:serverTimestamp()});
     return "confirmado";
    });
    if(estado==="conflicto"){conflictos++;continue;}
    await confirmarSincronizacion(r.id,uid);enviados++;
   }catch{return {enviados,error:"No se confirmó el envío. Fichas conservadas; revisa la jornada, permisos y conexión."};}
  }
  return {enviados,error:conflictos?conflictos+" ficha(s) en conflicto: ya existe esa cédula con otros datos. No se sobrescribió nada. Requieren revisión del coordinador.":""};
 });
}
