// src/pages/Home.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProsilodBanner from "../components/ProsilodBanner";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null; // protección básica

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">Zoriapp</h1>
        <p className="home-subtitle">Panel principal de la jornada</p>

        {/* Botones principales */}
        <div className="home-buttons-grid">
          <button className="home-button home-button-primary" onClick={() => navigate("/registro")}>
            Registro
          </button>

          <button className="home-button" onClick={() => navigate("/tacto")}>
            Tacto
          </button>

          <button className="home-button" onClick={() => navigate("/mini-jornada")}>
            Mini Jornada
          </button>

          <button className="home-button" onClick={() => navigate("/pacientes")}>
            Pacientes
          </button>

          <button className="home-button" onClick={() => navigate("/laboratorio")}>
            Laboratorio
          </button>

          <button className="home-button" onClick={() => navigate("/validar-resultados")}>
            Validar resultados
          </button>
        </div>

        {/* Dashboard */}
        <div className="home-dashboard">
          <h2 className="dashboard-title">Dashboard</h2>
          <p className="dashboard-text">
            Próximamente: estadísticas generales, conteo de pacientes, informes y más.
          </p>
        </div>

        {/* Banner Prosilod (fuera del dashboard, mejor disposición) */}
        <ProsilodBanner />
      </div>
    </div>
  );
}
