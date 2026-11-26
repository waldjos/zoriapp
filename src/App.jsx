// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Páginas
import Login from "./pages/Login";
import Superadmin from "./pages/Superadmin";
import Home from "./pages/Home";
import RegistroPaciente from "./pages/RegistroPaciente";
import Pacientes from "./pages/Pacientes";
import PacienteDetalle from "./pages/PacienteDetalle";
import Tacto from "./pages/Tacto";
import Dashboard from "./pages/Dashboard";

// Componentes
import PrivateRoute from "./components/PrivateRoute";
import MainNav from "./components/MainNav";
import EstadoSincronizacion from "./components/EstadoSincronizacion";
import { pendientesLocales } from "./utils/colaPacientesOffline";

import "./App.css";
import "./responsive-light.css";
import "./zori-design-fidelidad.css";

function AppShell() {
  const { user, perfil, sede, loading, error, configurado, logout } = useAuth();
  const { pathname } = useLocation();
  const salir = async () => {
    if (user?.uid) {
      try {
        const sinSubir = await pendientesLocales(user.uid);
        if (sinSubir.length && !window.confirm(
          "Hay " + sinSubir.length + " registros SIN SINCRONIZAR en este teléfono. Si cierras sesión no podrás verlos hasta entrar nuevamente con esta cuenta. ¿Cerrar sesión?"
        )) return;
      } catch {
        if (!window.confirm("No se pudo comprobar la cola local. ¿Cerrar sesión de todos modos?")) return;
      }
    }
    await logout();
  };
  if (!configurado) return <main className="app-main"><h1>ZoriApp 2.0 · Entorno de pruebas</h1><p>Configura el proyecto Firebase multisede independiente. La base histórica no está conectada.</p></main>;
  if (loading) return <main className="app-main">Validando acceso autorizado…</main>;
  if (user && !perfil) return <main className="app-main"><p>{error || "Validando permisos de sede…"}</p><button onClick={salir}>Cerrar sesión</button></main>;
  const clinico = ["admin_sede","medico"].includes(perfil?.rol);
  return (
    <div className="app-shell" key={`${user?.uid || "anon"}:${sede?.id || "central"}`}>
      {clinico && <MainNav onLogout={salir} />}
      {user && !clinico && <header style={{padding:"1rem"}}><button onClick={salir}>Cerrar sesión</button></header>}
      {sede && pathname !== "/" && <EstadoSincronizacion user={user} /> }
      <main className="app-main">
        <Routes>
          <Route path="/login" element={user && perfil ? <Navigate to="/" replace/> : <Login />} />
          <Route path="/superadmin" element={<PrivateRoute roles={["superadmin"]}><Superadmin /></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/registro" element={<PrivateRoute roles={["admin_sede","medico","registrador"]}><RegistroPaciente /></PrivateRoute>} />
          <Route path="/tacto" element={<PrivateRoute><Tacto /></PrivateRoute>} />
          <Route path="/mini-jornada" element={<PrivateRoute><section style={{padding:"1rem"}}><h2>Módulo en revisión</h2><p>Deshabilitado en la prueba multisede hasta validar privacidad y configuración por institución. El PSA individual se registra en la ficha del paciente.</p></section></PrivateRoute>} />
          <Route path="/pacientes" element={<PrivateRoute><Pacientes /></PrivateRoute>} />
          <Route path="/pacientes/:id" element={<PrivateRoute><PacienteDetalle /></PrivateRoute>} />
          <Route path="/laboratorio" element={<PrivateRoute><section style={{padding:"1rem"}}><h2>Módulo en revisión</h2><p>Deshabilitado en la prueba multisede hasta validar privacidad y configuración por institución. El PSA individual se registra en la ficha del paciente.</p></section></PrivateRoute>} />
          <Route path="/validar-resultados" element={<PrivateRoute><Pacientes /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/importar-psa" element={<PrivateRoute><section style={{padding:"1rem"}}><h2>Módulo en revisión</h2><p>Deshabilitado en la prueba multisede hasta validar privacidad y configuración por institución. El PSA individual se registra en la ficha del paciente.</p></section></PrivateRoute>} />
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
