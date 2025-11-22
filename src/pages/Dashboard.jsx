// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Dashboard() {
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [totalLaboratorios, setTotalLaboratorios] = useState(0);
  const [pacientesPorLocalidad, setPacientesPorLocalidad] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Pacientes
        const pacientesSnap = await getDocs(collection(db, "pacientes"));
        const pacientes = pacientesSnap.docs.map((doc) => doc.data());
        setTotalPacientes(pacientes.length);

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

        // Laboratorios
        const labsSnap = await getDocs(collection(db, "laboratorios"));
        setTotalLaboratorios(labsSnap.size);
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
