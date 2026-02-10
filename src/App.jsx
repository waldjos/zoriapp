// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Páginas
import Login from "./pages/Login";
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

import "./App.css";

function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="app-header">
        {user && (
          <button onClick={logout} style={{ backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "999px", padding: "0.5rem 1.1rem", fontWeight: 600, cursor: "pointer" }}>
            Cerrar sesión
          </button>
        )}
      </header>
      {user && <MainNav />}
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
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
