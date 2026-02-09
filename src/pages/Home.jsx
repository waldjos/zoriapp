// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import ProsilodBanner from "../components/ProsilodBanner";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    atendidos: 0,
    entregados: 0,
    pendientesRetiro: 0,
  });
  const [cargandoStats, setCargandoStats] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDocs(collection(db, "pacientes"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const atendidos = list.filter((p) => p.tacto).length;
        const entregados = list.filter((p) => p.entregaResultados === "entregado").length;
        const pendientesRetiro = list.filter((p) => p.tacto && p.entregaResultados !== "entregado").length;
        setStats({ atendidos, entregados, pendientesRetiro });
      } catch (e) {
        console.error(e);
      } finally {
        setCargandoStats(false);
      }
    };
    if (user) cargar();
  }, [user]);

  if (!user) return null; // protección básica

  return (
    <div className="page home-page">
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

          <button className="home-button" onClick={() => navigate("/importar-psa")}>
            Importar PSA (.txt)
          </button>
        </div>

        {/* Dashboard */}
        <div className="home-dashboard">
          <h2 className="dashboard-title">Dashboard</h2>
          {cargandoStats ? (
            <p className="dashboard-text">Cargando estadísticas...</p>
          ) : (
            <div className="dashboard-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
              <div style={{ padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent)" }}>{stats.atendidos}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Pacientes atendidos</div>
              </div>
              <div style={{ padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#10b981" }}>{stats.entregados}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Resultados entregados</div>
              </div>
              <div style={{ padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f59e0b" }}>{stats.pendientesRetiro}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Pendientes por retiro</div>
              </div>
            </div>
          )}
        </div>

        {/* Banner Prosilod (fuera del dashboard, mejor disposición) */}
        <ProsilodBanner />
      </div>
      </div>
    </div>
  );
}
