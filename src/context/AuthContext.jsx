import { createContext, useContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, multisedeConfigurado } from "../firebase";

const AuthContext = createContext();
export function AuthProvider({children}) {
  const [user,setUser]=useState(null);
  const [perfil,setPerfil]=useState(null);
  const [sede,setSede]=useState(null);
  const [loading,setLoading]=useState(multisedeConfigurado);
  const [error,setError]=useState("");
  useEffect(()=>{
    if (!multisedeConfigurado) return;
    let stopPerfil=()=>{}, stopSede=()=>{};
    const stopAuth=onAuthStateChanged(auth,u=>{
      stopPerfil(); stopSede();
      setUser(u); setPerfil(null); setSede(null); setError("");
      if (!u) {setLoading(false);return;}
      setLoading(true);
      const fail=()=>{stopSede();setPerfil(null);setSede(null);setError("No se pudo validar el acceso. Contacta al administrador.");setLoading(false);};
      stopPerfil=onSnapshot(doc(db,"usuarios",u.uid),{includeMetadataChanges:true},snap=>{
        if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
        stopSede(); setPerfil(null); setSede(null);
        const p=snap.data();
        if (!p?.activo || !["superadmin","admin_sede","medico","registrador"].includes(p.rol)) {fail();return;}
        if(p.rol==="superadmin"){setPerfil(p);setError("");setLoading(false);return;}
        if(typeof p.sedeId!=="string" || !p.sedeId) {fail();return;}
        stopSede=onSnapshot(doc(db,"sedes",p.sedeId),{includeMetadataChanges:true},ss=>{
          if(ss.metadata.fromCache || ss.metadata.hasPendingWrites) return;
          const s=ss.data();
          if(!s?.activa){setPerfil(null);setSede(null);setError("La sede no está habilitada.");setLoading(false);return;}
          setPerfil(p);setSede({...s,id:ss.id});setError("");setLoading(false);
        },fail);
      },fail);
    });
    return ()=>{stopAuth();stopPerfil();stopSede();};
  },[]);
  return <AuthContext.Provider value={{user,perfil,sede,loading,error,configurado:multisedeConfigurado,
    login:(email,password)=>signInWithEmailAndPassword(auth,email,password),logout:()=>signOut(auth)}}>
    {children}
  </AuthContext.Provider>;
}
export function useAuth(){return useContext(AuthContext);}
