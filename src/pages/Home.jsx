// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { formatoNombre, formatoCedula, nombreParaBusqueda } from "../utils/formatoPaciente";
import { getPSARiskCategory } from "../utils/psaUtils";
import ProsilodBanner from "../components/ProsilodBanner";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    atendidos: 0,
    entregados: 0,
    pendientesRetiro: 0,
  });
  const [riesgoStats, setRiesgoStats] = useState({
    sinRiesgo: 0,
    intermedio: 0,
    alto: 0,
    sinDato: 0,
  });
  const [pacientesList, setPacientesList] = useState([]);
  const [cargandoStats, setCargandoStats] = useState(true);
  const [showModalEntregados, setShowModalEntregados] = useState(false);
  const [busquedaEntregados, setBusquedaEntregados] = useState("");

  // Suscripción en tiempo real para que el listado y las estadísticas se actualicen al confirmar entrega
  useEffect(() => {
    if (!user) return;
    setCargandoStats(true);
    const unsubscribe = onSnapshot(
      collection(db, "pacientes"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPacientesList(list);
        const atendidos = list.filter((p) => p.tacto).length;
        const entregados = list.filter((p) => p.entregaResultados === "entregado").length;
        const pendientesRetiro = list.filter((p) => p.tacto && p.entregaResultados !== "entregado").length;
        setStats({ atendidos, entregados, pendientesRetiro });

        // Clasificación de riesgo por PSA para el dashboard principal
        const riesgoCounts = {
          sinRiesgo: 0,
          intermedio: 0,
          alto: 0,
          sinDato: 0,
        };

        list.forEach((p) => {
          const categoria = getPSARiskCategory(p.psaTotal, p.psaLibre);
          if (!categoria) {
            riesgoCounts.sinDato += 1;
            return;
          }
          if (categoria === "sin_riesgo") riesgoCounts.sinRiesgo += 1;
          else if (categoria === "riesgo_intermedio") riesgoCounts.intermedio += 1;
          else if (categoria === "alto_riesgo") riesgoCounts.alto += 1;
        });

        setRiesgoStats(riesgoCounts);
        setCargandoStats(false);
      },
      (err) => {
        console.error("Error cargando pacientes en Home:", err);
        setCargandoStats(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const pacientesEntregados = pacientesList.filter((p) => p.entregaResultados === "entregado");
  const pacientesEntregadosFiltrados = busquedaEntregados.trim()
    ? pacientesEntregados.filter((p) => {
        const term = busquedaEntregados.trim();
        const nombreTexto = p.nombreCompleto ?? p.nombre ?? "";
        const nombreBusqueda = nombreParaBusqueda(nombreTexto);
        const cedula = formatoCedula(p.cedula);
        const termNombre = nombreParaBusqueda(term);
        const termDigitos = formatoCedula(term);
        const coincideNombre =
          nombreBusqueda.includes(termNombre) ||
          (termNombre.length > 0 && termNombre.split(/\s+/).every((palabra) => nombreBusqueda.includes(palabra)));
        return coincideNombre || cedula.includes(termDigitos);
      })
    : pacientesEntregados;

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
            <>
              <div className="dashboard-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
                <div style={{ padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent)" }}>{stats.atendidos}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Pacientes atendidos</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowModalEntregados(true); setBusquedaEntregados(""); }}
                  style={{ padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center", cursor: "pointer", width: "100%", color: "inherit", font: "inherit" }}
                >
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#10b981" }}>{stats.entregados}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Resultados entregados</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Ver listado</div>
                </button>
                <div style={{ padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f59e0b" }}>{stats.pendientesRetiro}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Pendientes por retiro</div>
                </div>
              </div>

              {/* Distribución por nivel de riesgo (PSA) */}
              <div style={{ marginTop: "1.25rem" }}>
                <h3 style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  Distribución por nivel de riesgo (PSA)
                </h3>
                <div className="dashboard-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem" }}>
                  <div style={{ padding: "0.85rem", background: "var(--bg-soft)", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.25)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#22c55e" }}>{riesgoStats.sinRiesgo}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Sin riesgo</div>
                  </div>
                  <div style={{ padding: "0.85rem", background: "var(--bg-soft)", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.25)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#eab308" }}>{riesgoStats.intermedio}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Riesgo intermedio</div>
                  </div>
                  <div style={{ padding: "0.85rem", background: "var(--bg-soft)", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.25)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f97316" }}>{riesgoStats.alto}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Alto riesgo</div>
                  </div>
                </div>
                {riesgoStats.sinDato > 0 && (
                  <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Pacientes sin datos suficientes de PSA para clasificar:{" "}
                    <strong>{riesgoStats.sinDato}</strong>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal: listado de pacientes con resultados entregados */}
        {showModalEntregados && (
          <div
            className="home-dashboard"
            style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowModalEntregados(false)}
            role="dialog"
            aria-label="Pacientes con resultados entregados"
          >
            <div
              style={{ background: "var(--bg-card)", borderRadius: "12px", padding: "1.5rem", maxWidth: "480px", width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Resultados entregados</h3>
                <button type="button" onClick={() => setShowModalEntregados(false)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--text-muted)" }} aria-label="Cerrar">×</button>
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={busquedaEntregados}
                onChange={(e) => setBusquedaEntregados(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", marginBottom: "1rem", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.3)", background: "var(--bg-soft)", color: "var(--text)", fontSize: "0.9rem" }}
                aria-label="Buscar paciente"
              />
              {pacientesEntregados.length === 0 ? (
                <p style={{ color: "var(--text-muted)", margin: 0 }}>Ningún paciente con resultados entregados.</p>
              ) : pacientesEntregadosFiltrados.length === 0 ? (
                <p style={{ color: "var(--text-muted)", margin: 0 }}>Ningún resultado para &quot;{busquedaEntregados.trim()}&quot;</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {pacientesEntregadosFiltrados.map((p) => (
                    <li key={p.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(148,163,184,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <span><strong>{formatoNombre(p.nombreCompleto) || "-"}</strong> · Cédula: {formatoCedula(p.cedula) || "-"}</span>
                      <button type="button" onClick={() => { navigate(`/pacientes/${p.id}`); setShowModalEntregados(false); }} style={{ padding: "0.35rem 0.75rem", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" }}>Ver ficha</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Banner Prosilod (fuera del dashboard, mejor disposición) */}
        <ProsilodBanner />
      </div>
      </div>
    </div>
  );
}
