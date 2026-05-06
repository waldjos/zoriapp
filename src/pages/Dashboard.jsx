// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getPSARiskCategory } from "../utils/psaUtils";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const RISK_COLORS = {
  sin_riesgo: "#22c55e",
  riesgo_intermedio: "#f59e0b",
  alto_riesgo: "#ef4444",
  sinDato: "#64748b",
};

const formatLocalidad = (texto) => {
  const value = String(texto || "SIN LOCALIDAD").trim();
  return value === "" ? "SIN LOCALIDAD" : value.toUpperCase();
};

const menuItems = [
  { id: "resumen", label: "Resumen nacional" },
  { id: "riesgo", label: "Riesgo PSA" },
  { id: "localidades", label: "Top localidades" },
  { id: "impacto", label: "Impacto clínico" },
  { id: "descargas", label: "Descargas" },
];

export default function Dashboard() {
  const [cargando, setCargando] = useState(true);
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [totalLaboratorios, setTotalLaboratorios] = useState(0);
  const [riesgoStats, setRiesgoStats] = useState({
    sinRiesgo: 0,
    intermedio: 0,
    alto: 0,
    sinDato: 0,
  });
  const [topLocalidades, setTopLocalidades] = useState([]);
  const [metrics, setMetrics] = useState({
    conPSA: 0,
    conPSALibre: 0,
    conLab: 0,
    conEmail: 0,
  });

  useEffect(() => {
    const pacientesRef = collection(db, "pacientes");
    const unsubscribe = onSnapshot(
      pacientesRef,
      (snapshot) => {
        const pacientes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const total = pacientes.length;

        const riesgoCounts = { sinRiesgo: 0, intermedio: 0, alto: 0, sinDato: 0 };
        const localidadesMap = {};
        let conPSA = 0;
        let conPSALibre = 0;
        let conEmail = 0;

        pacientes.forEach((p) => {
          const categoria = getPSARiskCategory(p.psaTotal, p.psaLibre);
          if (!categoria) {
            riesgoCounts.sinDato += 1;
          } else if (categoria === "sin_riesgo") {
            riesgoCounts.sinRiesgo += 1;
          } else if (categoria === "riesgo_intermedio") {
            riesgoCounts.intermedio += 1;
          } else if (categoria === "alto_riesgo") {
            riesgoCounts.alto += 1;
          }

          const localidad = formatLocalidad(p.localidad);
          localidadesMap[localidad] = (localidadesMap[localidad] || 0) + 1;

          if (p.psaTotal != null && p.psaTotal !== "") {
            conPSA += 1;
          }
          if (p.psaLibre != null && p.psaLibre !== "") {
            conPSALibre += 1;
          }
          if (p.email) {
            conEmail += 1;
          }
        });

        const localidades = Object.entries(localidadesMap)
          .map(([localidad, cantidad]) => ({ localidad, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 7);

        const conLab = pacientes.filter((p) => p.laboratorioPdfUrl).length;

        setTotalPacientes(total);
        setTotalLaboratorios(conLab);
        setRiesgoStats(riesgoCounts);
        setTopLocalidades(localidades);
        setMetrics({ conPSA, conPSALibre, conLab, conEmail });
        setCargando(false);
      },
      (error) => {
        console.error("Error cargando estadísticas:", error);
        setCargando(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const riskChartData = useMemo(
    () => [
      { name: "Sin riesgo", value: riesgoStats.sinRiesgo, category: "sin_riesgo" },
      { name: "Riesgo intermedio", value: riesgoStats.intermedio, category: "riesgo_intermedio" },
      { name: "Alto riesgo", value: riesgoStats.alto, category: "alto_riesgo" },
      { name: "Sin datos", value: riesgoStats.sinDato, category: "sinDato" },
    ],
    [riesgoStats]
  );

  const localityChartData = useMemo(
    () =>
      topLocalidades.map((item) => ({
        localidad: item.localidad,
        cantidad: item.cantidad,
        porcentaje: totalPacientes > 0 ? Number(((item.cantidad / totalPacientes) * 100).toFixed(1)) : 0,
      })),
    [topLocalidades, totalPacientes]
  );

  const impactData = useMemo(
    () => [
      { label: "PSA total", value: metrics.conPSA, color: "#38bdf8" },
      { label: "PSA libre", value: metrics.conPSALibre, color: "#22c55e" },
      { label: "Laboratorio PDF", value: metrics.conLab, color: "#f59e0b" },
      { label: "Correos registrados", value: metrics.conEmail, color: "#8b5cf6" },
    ],
    [metrics]
  );

  if (cargando) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading-card">
          <p>Cargando el panel de estadísticas avanzadas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-head">
          <span className="sidebar-chip">NACIONAL</span>
          <h1>Panel ejecutivo</h1>
          <p className="sidebar-copy">
            Analítica de salud en tiempo real para el equipo médico. Navega por riesgo,
            localizaciones y calidad de datos.
          </p>
        </div>

        <div className="sidebar-summary">
          <div>
            <span>Total pacientes</span>
            <strong>{totalPacientes}</strong>
          </div>
          <div>
            <span>Laboratorios PDF</span>
            <strong>{totalLaboratorios}</strong>
          </div>
        </div>

        <div className="sidebar-menu">
          <h2>Secciones</h2>
          <nav>
            {menuItems.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="sidebar-link">
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="sidebar-metrics">
          <p className="sidebar-section-title">Indicadores clave</p>
          <div className="metric-pill">
            <span>PSA total</span>
            <strong>{metrics.conPSA}</strong>
          </div>
          <div className="metric-pill">
            <span>PSA libre</span>
            <strong>{metrics.conPSALibre}</strong>
          </div>
          <div className="metric-pill">
            <span>Correos activos</span>
            <strong>{metrics.conEmail}</strong>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <section className="dashboard-hero" id="resumen">
          <div>
            <p className="eyebrow">Visión estratégica</p>
            <h2>Estadísticas nacionales de salud</h2>
            <p>
              Un tablero interactivo con indicadores sanitarios, niveles de riesgo PSA y
              la distribución geográfica de pacientes por localidad.
            </p>
          </div>
          <div className="hero-flare" />
        </section>

        <section className="dashboard-grid" aria-label="Resumen rápido">
          <article className="dashboard-card card-highlight">
            <p className="card-label">Pacientes atendidos</p>
            <h3>{totalPacientes}</h3>
            <p className="card-detail">Actualizado en tiempo real desde Firebase.</p>
          </article>
          <article className="dashboard-card card-highlight">
            <p className="card-label">Estudios cargados</p>
            <h3>{totalLaboratorios}</h3>
            <p className="card-detail">Laboratorios PDF disponibles.</p>
          </article>
          <article className="dashboard-card card-highlight">
            <p className="card-label">Pacientes con PSA</p>
            <h3>{metrics.conPSA}</h3>
            <p className="card-detail">Valores de PSA total registrados.</p>
          </article>
        </section>

        <section className="dashboard-card" id="riesgo">
          <div className="section-header">
            <div>
              <h2>Distribución de riesgo PSA</h2>
              <p>Clasificación nacional de riesgos según PSA total y PSA libre.</p>
            </div>
            <div className="legend-grid">
              {riskChartData.map((item) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-dot" style={{ background: RISK_COLORS[item.category] }} />
                  <div>
                    <p>{item.name}</p>
                    <strong>{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-panel">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={80}
                  outerRadius={130}
                  paddingAngle={4}
                  animationDuration={1800}
                >
                  {riskChartData.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.2)", borderRadius: 14 }}
                  formatter={(value) => [value, "Pacientes"]}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dashboard-card" id="localidades">
          <div className="section-header">
            <div>
              <h2>Top localidades por volumen de pacientes</h2>
              <p>Agrupamos las localidades en mayúsculas para evitar duplicidad de nombres.</p>
            </div>
          </div>

          <div className="mix-panel">
            <div className="bar-chart-panel">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={localityChartData} margin={{ top: 24, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="localidad" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.2)", borderRadius: 14 }}
                  />
                  <Bar dataKey="cantidad" name="Pacientes" fill="#38bdf8" radius={[10, 10, 0, 0]} animationDuration={1700} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="locality-list">
              <h3>Localidades principales</h3>
              <ol>
                {localityChartData.map((item) => (
                  <li key={item.localidad}>
                    <span>{item.localidad}</span>
                    <strong>{item.cantidad}</strong>
                    <small>{item.porcentaje}%</small>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="dashboard-card" id="impacto">
          <div className="section-header">
            <div>
              <h2>Panel de impacto clínico</h2>
              <p>Indicadores de calidad de datos y alcance operativo.</p>
            </div>
          </div>

          <div className="impact-grid">
            {impactData.map((item) => (
              <div key={item.label} className="impact-card">
                <div className="impact-icon" style={{ backgroundColor: item.color }} />
                <div>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="chart-panel small-chart">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={impactData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5eead4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#020617" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,.2)", borderRadius: 14 }} />
                <Area type="monotone" dataKey="value" stroke="#34d399" fill="url(#colorImpact)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dashboard-card" id="descargas">
          <div className="section-header">
            <div>
              <h2>Menú de descargas y acciones</h2>
              <p>Exporta los datos con un solo clic y mantén el panel actualizado.</p>
            </div>
          </div>

          <div className="action-panel">
            <button className="btn-primary" type="button">
              Ver datos completos
            </button>
            <button className="btn-secondary" type="button">
              Abrir gestión de pacientes
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
