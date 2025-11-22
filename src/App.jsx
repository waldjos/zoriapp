// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Páginas
import Login from "./pages/Login";
import Home from "./pages/Home";
import RegistroPaciente from "./pages/RegistroPaciente";
import Pacientes from "./pages/Pacientes";
import PacienteDetalle from "./pages/PacienteDetalle";
import LabForm from "./pages/LabForm";
import Tacto from "./pages/Tacto";
import Dashboard from "./pages/Dashboard";

// Componentes
import PrivateRoute from "./components/PrivateRoute";

import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-shell">
          <main className="app-main">
            <Routes>
              {/* Login */}
              <Route path="/login" element={<Login />} />

              {/* Home con los botones principales */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />

              {/* Registro: solo alta de paciente */}
              <Route
                path="/registro"
                element={
                  <PrivateRoute>
                    <RegistroPaciente />
                  </PrivateRoute>
                }
              />

              {/* Tacto: búsqueda + evaluación médica */}
              <Route
                path="/tacto"
                element={
                  <PrivateRoute>
                    <Tacto />
                  </PrivateRoute>
                }
              />

              {/* Pacientes: listado + buscador + acciones */}
              <Route
                path="/pacientes"
                element={
                  <PrivateRoute>
                    <Pacientes />
                  </PrivateRoute>
                }
              />

              {/* Ficha individual de paciente */}
              <Route
                path="/pacientes/:id"
                element={
                  <PrivateRoute>
                    <PacienteDetalle />
                  </PrivateRoute>
                }
              />

              {/* Laboratorio: subida de PDF */}
              <Route
                path="/laboratorio"
                element={
                  <PrivateRoute>
                    <LabForm />
                  </PrivateRoute>
                }
              />

              {/* Validar resultados: reutiliza la lista de pacientes */}
              <Route
                path="/validar-resultados"
                element={
                  <PrivateRoute>
                    <Pacientes />
                  </PrivateRoute>
                }
              />

              {/* Dashboard de estadísticas */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />

              {/* Cualquier otra ruta redirige al home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
