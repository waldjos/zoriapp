// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Páginas
import Login from "./pages/Login";
import PanelCentral from "./pages/PanelCentral";
import Catia from "./pages/Catia";
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

import "./App.css";
import "./responsive-light.css";
import "./zori-design-fidelidad.css";

function AppShell() {
  const { user, logout } = useAuth();
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
  if (pathname === "/catia") return <div className="app-shell"><main className="app-main">{user ? <Catia key={user.uid} onLogout={salir}/> : <Login destino="/catia"/>}</main></div>;
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
