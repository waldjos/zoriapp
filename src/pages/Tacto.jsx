// src/pages/Tacto.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import ProsilodBanner from "../components/ProsilodBanner";
import { useAuth } from "../context/AuthContext.jsx";
import * as XLSX from 'xlsx';

export default function Tacto() {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const { user } = useAuth();

  // Estado del formulario de evaluación
  const [evaluacion, setEvaluacion] = useState({
    tamanio: "", // I, II, III
    fibroelastica: false,
    aumentadaConsistencia: false,
    petrea: false,
    bordes: "", // regulares / irregulares
    nodulos: "", // "si" / "no"
    ladoNodulo: "", // derecho / izquierdo
    planosClivaje: "", // si / no
  });

  // Cargar pacientes una vez
  useEffect(() => {
    const cargarPacientes = async () => {
      try {
        const snap = await getDocs(collection(db, "pacientes"));
        const datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPacientes(datos);
      } catch (err) {
        console.error("Error cargando pacientes:", err);
      }
    };

    cargarPacientes();
  }, []);

  // Columnas a mostrar/exportar para tacto
  const exportColumns = [
    { key: 'nombreCompleto', label: 'Nombre' },
    { key: 'cedula', label: 'Cédula' },
    { key: 'tacto.tamanio', label: 'Tamaño' },
    { key: 'tacto.fibroelastica', label: 'Fibroelástica' },
    { key: 'tacto.aumentadaConsistencia', label: 'Aumentada de consistencia' },
    { key: 'tacto.petrea', label: 'Pétrea' },
    { key: 'tacto.bordes', label: 'Bordes' },
    { key: 'tacto.nodulos', label: 'Nódulos' },
    { key: 'tacto.ladoNodulo', label: 'Lado del nódulo' },
    { key: 'tacto.planosClivaje', label: 'Planos de clivaje' },
  ];

  const exportToCSV = () => {
    const list = pacientesFiltrados.filter((p) => p.tacto); // Solo pacientes con tacto
    if (!list || list.length === 0) {
      alert('No hay pacientes con evaluaciones de tacto para exportar.');
      return;
    }

    // Preparar datos para Excel
    const data = [];
    // Headers
    const headers = exportColumns.map((c) => c.label);
    data.push(headers);

    // Rows
    list.forEach((p) => {
      const row = exportColumns.map((col) => {
        let v = '';
        if (col.key.includes('.')) {
          const [obj, prop] = col.key.split('.');
          v = p[obj]?.[prop] ?? '';
        } else {
          v = p[col.key] ?? '';
        }
        // Convertir booleanos a Sí/No
        if (typeof v === 'boolean') {
          v = v ? 'Sí' : 'No';
        }
        return v;
      });
      data.push(row);
    });

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Establecer anchos de columna
    const colWidths = headers.map(() => ({ wch: 20 })); // Ancho aproximado
    ws['!cols'] = colWidths;

    // Estilo por defecto: Arial 12, bordes
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        if (!ws[cell_ref]) continue;
        ws[cell_ref].s = {
          font: { name: 'Arial', sz: 12 },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      }
    }

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Tacto');

    // Exportar
    XLSX.writeFile(wb, `tacto_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const seleccionarPaciente = (paciente) => {
    setSeleccionado(paciente);
    setMensaje("");

    // Si el paciente ya tiene una evaluación, la cargamos
    if (paciente.tacto) {
      setEvaluacion({
        tamanio: paciente.tacto.tamanio || "",
        fibroelastica: paciente.tacto.fibroelastica || false,
        aumentadaConsistencia: paciente.tacto.aumentadaConsistencia || false,
        petrea: paciente.tacto.petrea || false,
        bordes: paciente.tacto.bordes || "",
        nodulos: paciente.tacto.nodulos || "",
        ladoNodulo: paciente.tacto.ladoNodulo || "",
        planosClivaje: paciente.tacto.planosClivaje || "",
      });
    } else {
      setEvaluacion({
        tamanio: "",
        fibroelastica: false,
        aumentadaConsistencia: false,
        petrea: false,
        bordes: "",
        nodulos: "",
        ladoNodulo: "",
        planosClivaje: "",
      });
    }
  };

  const handleChangeRadio = (campo, valor) => {
    setEvaluacion((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleChangeCheck = (campo) => {
    setEvaluacion((prev) => ({ ...prev, [campo]: !prev[campo] }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!seleccionado) return;

    setGuardando(true);
    setMensaje("");

    try {
      const ref = doc(db, "pacientes", seleccionado.id);
      // Añadir metadata del profesional que registra la evaluación
      await updateDoc(ref, {
        tacto: {
          ...evaluacion,
          actualizadoEn: new Date(),
          medicoId: user?.uid || null,
          medicoEmail: user?.email || null,
        },
      });

      setMensaje("Evaluación guardada correctamente.");
    } catch (err) {
      console.error(err);
      setMensaje("No se pudo guardar la evaluación.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header-title">Evaluación médica</h1>
        <p className="page-header-subtitle">
          Busca al paciente por nombre o cédula y registra los hallazgos del tacto.
        </p>
      </div>

      {/* Buscador */}
      <div className="list-card">
        <div className="list-header">
          <div className="list-header-top">
            <div className="list-title">Buscar paciente</div>
            <button type="button" onClick={exportToCSV} style={{ backgroundColor: '#111827', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}>Exportar Excel</button>
          </div>
          <input
            className="search-input"
            type="text"
            placeholder="Nombre o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* Lista corta de resultados */}
        <div className="table-wrapper">
          <table className="pacientes-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cédula</th>
                <th>Edad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pacientesFiltrados.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombreCompleto}</td>
                  <td>{p.cedula}</td>
                  <td>{p.edad}</td>
                  <td>
                    <button
                      className="badge-pill"
                      type="button"
                      onClick={() => seleccionarPaciente(p)}
                    >
                      Evaluar
                    </button>
                  </td>
                </tr>
              ))}

              {pacientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={4}>No se encontraron pacientes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario de evaluación */}
      {seleccionado && (
        <div className="form-card" style={{ marginTop: "1.2rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.4rem" }}>
            Evaluación de: {seleccionado.nombreCompleto}
          </h2>
          <p style={{ fontSize: "0.8rem", marginBottom: "0.9rem", color: "#9ca3af" }}>
            C.I.: {seleccionado.cedula} • Edad: {seleccionado.edad} • Tel:{" "}
            {seleccionado.telefono}
          </p>

          <form onSubmit={handleGuardar} className="form-grid">
            {/* Tamaño */}
            <div>
              <label>Tamaño</label>
              <div className="form-row-inline">
                {["I", "II", "III"].map((nivel) => (
                  <label key={nivel} style={{ display: "flex", gap: "0.25rem" }}>
                    <input
                      type="radio"
                      name="tamanio"
                      value={nivel}
                      checked={evaluacion.tamanio === nivel}
                      onChange={() => handleChangeRadio("tamanio", nivel)}
                    />
                    <span>{nivel}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Características */}
            <div>
              <label>Características</label>
              <div className="form-row-inline">
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="checkbox"
                    checked={evaluacion.fibroelastica}
                    onChange={() => handleChangeCheck("fibroelastica")}
                  />
                  <span>Fibroelástica</span>
                </label>
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="checkbox"
                    checked={evaluacion.aumentadaConsistencia}
                    onChange={() => handleChangeCheck("aumentadaConsistencia")}
                  />
                  <span>Aumentada de consistencia</span>
                </label>
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="checkbox"
                    checked={evaluacion.petrea}
                    onChange={() => handleChangeCheck("petrea")}
                  />
                  <span>Pétrea</span>
                </label>
              </div>
            </div>

            {/* Bordes */}
            <div>
              <label>Bordes</label>
              <div className="form-row-inline">
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="radio"
                    name="bordes"
                    value="regulares"
                    checked={evaluacion.bordes === "regulares"}
                    onChange={() => handleChangeRadio("bordes", "regulares")}
                  />
                  <span>Regulares</span>
                </label>
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="radio"
                    name="bordes"
                    value="irregulares"
                    checked={evaluacion.bordes === "irregulares"}
                    onChange={() => handleChangeRadio("bordes", "irregulares")}
                  />
                  <span>Irregulares</span>
                </label>
              </div>
            </div>

            {/* Nódulos */}
            <div>
              <label>Nódulos</label>
              <div className="form-row-inline">
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="radio"
                    name="nodulos"
                    value="si"
                    checked={evaluacion.nodulos === "si"}
                    onChange={() => handleChangeRadio("nodulos", "si")}
                  />
                  <span>Sí</span>
                </label>
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="radio"
                    name="nodulos"
                    value="no"
                    checked={evaluacion.nodulos === "no"}
                    onChange={() => handleChangeRadio("nodulos", "no")}
                  />
                  <span>No</span>
                </label>
              </div>

              {evaluacion.nodulos === "si" && (
                <div style={{ marginTop: "0.4rem" }}>
                  <label>Lado</label>
                  <div className="form-row-inline">
                    <label style={{ display: "flex", gap: "0.25rem" }}>
                      <input
                        type="radio"
                        name="ladoNodulo"
                        value="derecho"
                        checked={evaluacion.ladoNodulo === "derecho"}
                        onChange={() => handleChangeRadio("ladoNodulo", "derecho")}
                      />
                      <span>Derecho</span>
                    </label>
                    <label style={{ display: "flex", gap: "0.25rem" }}>
                      <input
                        type="radio"
                        name="ladoNodulo"
                        value="izquierdo"
                        checked={evaluacion.ladoNodulo === "izquierdo"}
                        onChange={() => handleChangeRadio("ladoNodulo", "izquierdo")}
                      />
                      <span>Izquierdo</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Planos de clivaje */}
            <div>
              <label>Planos de clivaje</label>
              <div className="form-row-inline">
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="radio"
                    name="planosClivaje"
                    value="si"
                    checked={evaluacion.planosClivaje === "si"}
                    onChange={() => handleChangeRadio("planosClivaje", "si")}
                  />
                  <span>Sí</span>
                </label>
                <label style={{ display: "flex", gap: "0.25rem" }}>
                  <input
                    type="radio"
                    name="planosClivaje"
                    value="no"
                    checked={evaluacion.planosClivaje === "no"}
                    onChange={() => handleChangeRadio("planosClivaje", "no")}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            {/* Mensajes */}
            {mensaje && (
              <p className={mensaje.includes("No se pudo") ? "status-error" : "status-ok"}>
                {mensaje}
              </p>
            )}

            <button
              type="submit"
              className="primary-btn"
              disabled={guardando}
              style={{ marginTop: "0.4rem" }}
            >
              {guardando ? "Guardando..." : "Guardar evaluación"}
            </button>
          </form>
        </div>
      )}
      <ProsilodBanner />
    </div>
  );
}
