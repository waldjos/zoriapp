// src/App.jsx
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { destinoInstitucional } from "./utils/destinoInstitucional";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Páginas
import Login from "./pages/Login";
import PanelCentral from "./pages/PanelCentral";
import Catia from "./pages/Catia";
import Contingencia from "./pages/Contingencia";
import {observarMiembroContingencia} from "./utils/accesoContingencia";
import Home from "./pages/Home";
import RegistroPaciente from "./pages/RegistroPaciente";
import Pacientes from "./pages/Pacientes";
import PacienteDetalle from "./pages/PacienteDetalle";
import LabForm from "./pages/LabForm";
import Tacto from "./pages/Tacto";
import Dashboard from "./pages/Dashboard";
import MiniJornada from "./pages/MiniJornada";
import ImportarPSA from "./pages/ImportarPSA";

// Componentes
import PrivateRoute from "./components/PrivateRoute";
import MainNav from "./components/MainNav";
import EstadoSincronizacion from "./components/EstadoSincronizacion";
import { pendientesLocales } from "./utils/colaPacientesOffline";
import { pendientesLocales as pendientesCatia } from "./utils/colaCatiaOffline";

import "./App.css";
import "./responsive-light.css";
import "./zori-design-fidelidad.css";

function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const uid=user?.uid;
  const [acceso,setAcceso]=useState(null);
  const [emergencia,setEmergencia]=useState(null);
  useEffect(()=>{if(!uid){setEmergencia(null);return;}return observarMiembroContingencia(uid,p=>setEmergencia({uid,estado:p===null?"normal":p.activo===true&&p.rol==="medico"&&["domingo_luciani","periferico_catia"].includes(p.sedeId)?"contingencia":"denegado"}),()=>setEmergencia({uid,estado:"error"}));},[uid]);
  const modo=emergencia?.uid===uid?emergencia.estado:null;
  useEffect(()=>{
    if(!uid||modo!=="normal"||pathname==="/contingencia"){setAcceso(null);return;}
    return onSnapshot(doc(db,"usuarios",uid),{includeMetadataChanges:true},snap=>{
      if(snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
      setAcceso({uid,destino:destinoInstitucional(snap.data())});
    },()=>setAcceso({uid,destino:"denegado"}));
  },[uid,modo,pathname==="/contingencia"]);
  const salir = async () => {
    if (user?.uid) {
      try {
        const sinSubir = [...await pendientesCatia(user.uid),...await pendientesLocales(user.uid)];
        if (sinSubir.length && !window.confirm(
          "Hay " + sinSubir.length + " registros SIN SINCRONIZAR en este teléfono. Si cierras sesión no podrás verlos hasta entrar nuevamente con esta cuenta. ¿Cerrar sesión?"
        )) return;
      } catch {
        if (!window.confirm("No se pudo comprobar la cola local. ¿Cerrar sesión de todos modos?")) return;
      }
    }
    await logout();
  };
  if(user&&modo==="contingencia") return <div className="app-shell"><main className="app-main"><Contingencia key={uid} onLogout={salir}/></main></div>;
  if(user&&modo!=="normal") return <div className="app-shell"><main className="app-main"><section className="page-container"><h1>{modo==="denegado"?"Acceso no habilitado":modo==="error"?"No se pudo verificar el acceso":"Verificando sede"}</h1><p>Comprueba la conexión. No se consulta Firestore hasta validar el modo de atención.</p><button type="button" onClick={salir}>Cerrar sesión</button></section></main></div>;
  if(pathname==="/contingencia") return <div className="app-shell"><main className="app-main">{user?<Contingencia key={uid} onLogout={salir}/>:<Login destino="/contingencia"/>}</main></div>;
  if(!user && pathname==="/catia") return <div className="app-shell"><main className="app-main"><Login destino="/catia"/></main></div>;
  if(user){
    const destino=acceso?.uid===uid?acceso.destino:null;
    if(!destino || destino==="denegado") return <div className="app-shell"><main className="app-main"><section className="page-container"><h1>{destino?"Acceso no habilitado":"Verificando perfil institucional"}</h1><p>Se requiere un perfil activo confirmado por el servidor. Comprueba tu conexión.</p><button type="button" onClick={salir}>Cerrar sesión</button></section></main></div>;
    if(destino==="catia") {
      if(pathname!=="/catia")return <Navigate to="/catia" replace/>;
      return <div className="app-shell"><main className="app-main"><Catia key={uid} onLogout={salir}/></main></div>;
    }
    if(pathname==="/catia" || pathname==="/login")return <Navigate to={destino==="admin"?"/superadmin":"/"} replace/>;
    if(pathname==="/superadmin"&&destino!=="admin")return <Navigate to="/" replace/>;
  }
  return (
    <div className="app-shell">
      {user && <MainNav onLogout={salir} />}
      {user && pathname !== "/" && pathname !== "/superadmin" && <EstadoSincronizacion user={user} />}
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/superadmin" element={<PrivateRoute><PanelCentral /></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/registro" element={<PrivateRoute><RegistroPaciente /></PrivateRoute>} />
          <Route path="/tacto" element={<PrivateRoute><Tacto /></PrivateRoute>} />
          <Route path="/mini-jornada" element={<PrivateRoute><MiniJornada /></PrivateRoute>} />
          <Route path="/pacientes" element={<PrivateRoute><Pacientes /></PrivateRoute>} />
          <Route path="/pacientes/:id" element={<PrivateRoute><PacienteDetalle /></PrivateRoute>} />
          <Route path="/laboratorio" element={<PrivateRoute><LabForm /></PrivateRoute>} />
          <Route path="/validar-resultados" element={<PrivateRoute><Pacientes /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/importar-psa" element={<PrivateRoute><ImportarPSA /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}

export default App;
