// src/pages/PacienteDetalle.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";

export default function PacienteDetalle() {
  const { id } = useParams(); // ID del documento en "pacientes"
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---- Estado del paciente ----
  const [paciente, setPaciente] = useState(null);
  const [cargandoPaciente, setCargandoPaciente] = useState(true);
  const [errorPaciente, setErrorPaciente] = useState("");

  // ---- Estado del formulario de evaluación clínica ----
  const [tamano, setTamano] = useState("II");
  const [carFibroelastica, setCarFibroelastica] = useState(false);
  const [carAumentadaConsistencia, setCarAumentadaConsistencia] =
    useState(false);
  const [carPetrea, setCarPetrea] = useState(false);

  const [bordes, setBordes] = useState("regulares"); // "regulares" | "irregulares"

  const [nodulosPresencia, setNodulosPresencia] = useState("no"); // "si" | "no"
  const [noduloDerecho, setNoduloDerecho] = useState(false);
  const [noduloIzquierdo, setNoduloIzquierdo] = useState(false);

  const [planosClivaje, setPlanosClivaje] = useState("si"); // "si" | "no"

  const [comentarios, setComentarios] = useState("");

  const [guardandoEval, setGuardandoEval] = useState(false);
  const [errorEval, setErrorEval] = useState("");
  const [successEval, setSuccessEval] = useState("");

  // ---- Lista de evaluaciones guardadas ----
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargandoEvaluaciones, setCargandoEvaluaciones] = useState(true);

  // ---------------------------------------------------
  // 1) Cargar datos del paciente
  // ---------------------------------------------------
  useEffect(() => {
    const cargarPaciente = async () => {
      try {
        const ref = doc(db, "pacientes", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setErrorPaciente("El paciente no existe.");
        } else {
          setPaciente({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error("Error cargando paciente:", err);
        setErrorPaciente("No se pudo cargar la información del paciente.");
      } finally {
        setCargandoPaciente(false);
      }
    };

    cargarPaciente();
  }, [id]);

  // ---------------------------------------------------
  // 2) Escuchar las evaluaciones clínicas en tiempo real
  // ---------------------------------------------------
  useEffect(() => {
    const colRef = collection(db, "pacientes", id, "evaluacionesClinicas");
    const q = query(colRef, orderBy("fecha", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setEvaluaciones(lista);
        setCargandoEvaluaciones(false);
      },
      (err) => {
        console.error("Error escuchando evaluaciones:", err);
        setCargandoEvaluaciones(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // ---------------------------------------------------
  // 3) Guardar una nueva evaluación
  // ---------------------------------------------------
  const handleGuardarEvaluacion = async (e) => {
    e.preventDefault();
    setErrorEval("");
    setSuccessEval("");
    setGuardandoEval(true);

    try {
      if (!user) {
        throw new Error("No hay usuario autenticado.");
      }

      const colRef = collection(db, "pacientes", id, "evaluacionesClinicas");

      await addDoc(colRef, {
        fecha: serverTimestamp(),
        medicoId: user.uid,

        tamano,

        caracteristicas: {
          fibroelastica: carFibroelastica,
          aumentadaConsistencia: carAumentadaConsistencia,
          petrea: carPetrea,
        },

        bordes,

        nodulos: {
          presencia: nodulosPresencia, // "si" / "no"
          derecho: noduloDerecho,
          izquierdo: noduloIzquierdo,
        },

        planosClivaje,

        comentarios: comentarios.trim(),
      });

      setSuccessEval("Evaluación guardada correctamente.");

      // Opcional: resetear algunos campos pero no todos
      setComentarios("");
    } catch (err) {
      console.error("Error guardando evaluación:", err);
      setErrorEval("No se pudo guardar la evaluación.");
    } finally {
      setGuardandoEval(false);
    }
  };

  const formatFecha = (ts) => {
    if (!ts) return "-";
    try {
      return ts.toDate().toLocaleString();
    } catch {
      return "-";
    }
  };

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------
  if (cargandoPaciente) {
    return (
      <div>
        <button onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
          ⬅ Volver
        </button>
        <p>Cargando paciente...</p>
      </div>
    );
  }

  if (errorPaciente || !paciente) {
    return (
      <div>
        <button onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
          ⬅ Volver
        </button>
        <p style={{ color: "red" }}>{errorPaciente || "Paciente no encontrado"}</p>
      </div>
    );
  }

  return (
    <div className="paciente-detalle-layout">
      <button onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        ⬅ Volver
      </button>

      {/* Datos principales del paciente */}
      <section className="paciente-detalle-header">
        <h1>{paciente.nombreCompleto}</h1>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Cédula:</strong> {paciente.cedula}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Edad:</strong> {paciente.edad ?? "-"} años
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Localidad:</strong> {paciente.localidad || "-"}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Correo:</strong> {paciente.email || "-"}
        </p>
      </section>

      <div className="paciente-detalle-grid">
        {/* FORMULARIO DE EVALUACIÓN MÉDICA */}
        <section className="paciente-evaluacion-section">
          <h2>Evaluación médica</h2>
          <p style={{ marginBottom: "0.75rem" }}>
            Registra la exploración física de la jornada.
          </p>

          <form onSubmit={handleGuardarEvaluacion}>
            {/* Tamaño */}
            <div className="field-group">
              <label className="field-label">Tamaño</label>
              <div className="field-options">
                <label>
                  <input
                    type="radio"
                    name="tamano"
                    value="I"
                    checked={tamano === "I"}
                    onChange={(e) => setTamano(e.target.value)}
                  />{" "}
                  I
                </label>
                <label>
                  <input
                    type="radio"
                    name="tamano"
                    value="II"
                    checked={tamano === "II"}
                    onChange={(e) => setTamano(e.target.value)}
                  />{" "}
                  II
                </label>
                <label>
                  <input
                    type="radio"
                    name="tamano"
                    value="III"
                    checked={tamano === "III"}
                    onChange={(e) => setTamano(e.target.value)}
                  />{" "}
                  III
                </label>
              </div>
            </div>

            {/* Características */}
            <div className="field-group">
              <label className="field-label">Características</label>
              <div className="field-options field-options-column">
                <label>
                  <input
                    type="checkbox"
                    checked={carFibroelastica}
                    onChange={(e) => setCarFibroelastica(e.target.checked)}
                  />{" "}
                  Fibroelástica
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={carAumentadaConsistencia}
                    onChange={(e) =>
                      setCarAumentadaConsistencia(e.target.checked)
                    }
                  />{" "}
                  Aumentada de consistencia
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={carPetrea}
                    onChange={(e) => setCarPetrea(e.target.checked)}
                  />{" "}
                  Pétrea
                </label>
              </div>
            </div>

            {/* Bordes */}
            <div className="field-group">
              <label className="field-label">Bordes</label>
              <div className="field-options">
                <label>
                  <input
                    type="radio"
                    name="bordes"
                    value="regulares"
                    checked={bordes === "regulares"}
                    onChange={(e) => setBordes(e.target.value)}
                  />{" "}
                  Regulares
                </label>
                <label>
                  <input
                    type="radio"
                    name="bordes"
                    value="irregulares"
                    checked={bordes === "irregulares"}
                    onChange={(e) => setBordes(e.target.value)}
                  />{" "}
                  Irregulares
                </label>
              </div>
            </div>

            {/* Nódulos */}
            <div className="field-group">
              <label className="field-label">Nódulos</label>
              <div className="field-options field-options-column">
                <div>
                  <label style={{ marginRight: "1rem" }}>
                    <input
                      type="radio"
                      name="nodulosPresencia"
                      value="si"
                      checked={nodulosPresencia === "si"}
                      onChange={(e) => setNodulosPresencia(e.target.value)}
                    />{" "}
                    Sí
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="nodulosPresencia"
                      value="no"
                      checked={nodulosPresencia === "no"}
                      onChange={(e) => setNodulosPresencia(e.target.value)}
                    />{" "}
                    No
                  </label>
                </div>

                {/* Si hay nódulos, especificar lado */}
                {nodulosPresencia === "si" && (
                  <div style={{ marginTop: "0.4rem" }}>
                    <label style={{ marginRight: "1rem" }}>
                      <input
                        type="checkbox"
                        checked={noduloDerecho}
                        onChange={(e) =>
                          setNoduloDerecho(e.target.checked)
                        }
                      />{" "}
                      Derecho
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={noduloIzquierdo}
                        onChange={(e) =>
                          setNoduloIzquierdo(e.target.checked)
                        }
                      />{" "}
                      Izquierdo
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Planos de clivaje */}
            <div className="field-group">
              <label className="field-label">Planos de clivaje</label>
              <div className="field-options">
                <label>
                  <input
                    type="radio"
                    name="planosClivaje"
                    value="si"
                    checked={planosClivaje === "si"}
                    onChange={(e) => setPlanosClivaje(e.target.value)}
                  />{" "}
                  Sí
                </label>
                <label>
                  <input
                    type="radio"
                    name="planosClivaje"
                    value="no"
                    checked={planosClivaje === "no"}
                    onChange={(e) => setPlanosClivaje(e.target.value)}
                  />{" "}
                  No
                </label>
              </div>
            </div>

            {/* Comentarios */}
            <div className="field-group">
              <label className="field-label">Comentarios / Hallazgos</label>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "0.5rem", resize: "vertical" }}
                placeholder="Notas adicionales de la exploración..."
              />
            </div>

            {errorEval && (
              <p style={{ color: "red", marginBottom: "0.5rem" }}>
                {errorEval}
              </p>
            )}
            {successEval && (
              <p style={{ color: "green", marginBottom: "0.5rem" }}>
                {successEval}
              </p>
            )}

            <button
              type="submit"
              disabled={guardandoEval}
              style={{
                width: "100%",
                padding: "0.7rem 1rem",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: "0.5rem",
              }}
            >
              {guardandoEval ? "Guardando..." : "GUARDAR EVALUACIÓN"}
            </button>
          </form>
        </section>

        {/* HISTORIAL DE EVALUACIONES */}
        <section className="paciente-evaluaciones-list">
          <h2>Historial de evaluaciones</h2>

          {cargandoEvaluaciones ? (
            <p>Cargando evaluaciones...</p>
          ) : evaluaciones.length === 0 ? (
            <p>No hay evaluaciones registradas aún.</p>
          ) : (
            <div className="pacientes-table-wrapper">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "0.5rem",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Fecha
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Tamaño
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Bordes
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Nódulos
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Planos de clivaje
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map((ev) => (
                    <tr key={ev.id}>
                      <td
                        style={{
                          padding: "0.4rem",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {formatFecha(ev.fecha)}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {ev.tamano || "-"}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {ev.bordes || "-"}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {ev.nodulos?.presencia === "si"
                          ? `Sí${
                              ev.nodulos?.derecho ? " (D)" : ""
                            }${ev.nodulos?.izquierdo ? " (I)" : ""}`
                          : "No"}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {ev.planosClivaje === "si" ? "Sí" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
