import {useEffect,useState} from "react";
import {doc,onSnapshot} from "firebase/firestore";
import {db} from "../firebase";
import {useAuth} from "../context/AuthContext";
// Este control visual NO sustituye las reglas Firestore: la colección sedes
// debe permanecer restringida al UID único definido en el servidor.
export function usePanelCentral(){
 const {user}=useAuth();
 const uid=user?.uid;
 const [state,setState]=useState({uid:null,autorizado:false,cargando:true});
 useEffect(()=>{
  if(!uid)return;
  let vivo=true;
  const stop=onSnapshot(doc(db,"usuarios",uid),{includeMetadataChanges:true},snap=>{
   if(!vivo)return;
   const p=snap.data();
   setState({uid,cargando:false,autorizado:!snap.metadata.fromCache && !snap.metadata.hasPendingWrites && p?.rol==="superadmin" && p?.activo===true});
  },()=>{if(vivo)setState({uid,cargando:false,autorizado:false});});
  return ()=>{vivo=false;stop();};
 },[uid]);
 return state.uid===uid && uid ? state : {autorizado:false,cargando:Boolean(uid)};
}
