// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { getPSARiskCategory } from "../utils/psaUtils";

export default function Dashboard() {
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [totalLaboratorios, setTotalLaboratorios] = useState(0);
  const [pacientesPorLocalidad, setPacientesPorLocalidad] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [riesgoStats, setRiesgoStats] = useState({
    sinRiesgo: 0,
    intermedio: 0,
    alto: 0,
    sinDato: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Pacientes
        const pacientesSnap = await getDocs(collection(db, "pacientes"));
        const pacientes = pacientesSnap.docs.map((doc) => doc.data());
        setTotalPacientes(pacientes.length);

        // Clasificación por riesgo PSA
        const riesgoCounts = {
          sinRiesgo: 0,
          intermedio: 0,
          alto: 0,
          sinDato: 0,
        };

        pacientes.forEach((p) => {
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

        // Agrupar por localidad
        const mapaLocalidades = {};
        pacientes.forEach((p) => {
          const loc = (p.localidad || "Sin localidad").trim();
          mapaLocalidades[loc] = (mapaLocalidades[loc] || 0) + 1;
        });

        const listaLocalidades = Object.entries(mapaLocalidades)
          .map(([localidad, cantidad]) => ({ localidad, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 5); // Top 5

        setPacientesPorLocalidad(listaLocalidades);

        // Pacientes con PDF de laboratorio asociado (LabForm guarda laboratorioPdfUrl en el paciente)
        const conLab = pacientes.filter((p) => p.laboratorioPdfUrl).length;
        setTotalLaboratorios(conLab);
      } catch (error) {
        console.error("Error cargando estadísticas:", error);
      } finally {
        setCargando(false);
      }
    };

    fetchStats();
  }, []);

  if (cargando) {
    return (
      <div className="page-container">
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Dashboard de la jornada</h1>
        <p className="page-subtitle">
          Resumen rápido de pacientes atendidos y estudios de laboratorio cargados.
        </p>
      </div>

      {/* Tarjetas principales */}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Pacientes registrados</p>
          <p className="stat-value">{totalPacientes}</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">PDF de laboratorio</p>
          <p className="stat-value">{totalLaboratorios}</p>
        </div>
      </div>

      {/* Riesgo por PSA */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 className="card-title">Distribución por nivel de riesgo (PSA)</h2>
        {totalPacientes === 0 ? (
          <p>No hay pacientes registrados todavía.</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Sin riesgo</p>
              <p className="stat-value">{riesgoStats.sinRiesgo}</p>
              <p className="stat-subvalue">
                {((riesgoStats.sinRiesgo / totalPacientes) * 100 || 0).toFixed(1)}%
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Riesgo intermedio</p>
              <p className="stat-value">{riesgoStats.intermedio}</p>
              <p className="stat-subvalue">
                {((riesgoStats.intermedio / totalPacientes) * 100 || 0).toFixed(1)}%
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Alto riesgo</p>
              <p className="stat-value">{riesgoStats.alto}</p>
              <p className="stat-subvalue">
                {((riesgoStats.alto / totalPacientes) * 100 || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
        {riesgoStats.sinDato > 0 && (
          <p className="card-subtext">
            Pacientes sin datos suficientes de PSA para clasificar:{" "}
            <strong>{riesgoStats.sinDato}</strong>
          </p>
        )}
      </div>

      {/* Pacientes por localidad */}
      <div className="card">
        <h2 className="card-title">Pacientes por localidad (Top 5)</h2>
        {pacientesPorLocalidad.length === 0 ? (
          <p>No hay datos suficientes todavía.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Localidad</th>
                  <th>Cantidad</th>
                  <th>% del total</th>
                </tr>
              </thead>
              <tbody>
                {pacientesPorLocalidad.map((item) => (
                  <tr key={item.localidad}>
                    <td>{item.localidad}</td>
                    <td>{item.cantidad}</td>
                    <td>
                      {totalPacientes > 0
                        ? ((item.cantidad / totalPacientes) * 100).toFixed(1) +
                          " %"
                        : "0 %"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
