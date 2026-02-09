// src/pages/PacienteDetalle.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";
import { getPSALibrePercent, getPSALibreInterpretation, shouldShowPSALibreRelation } from "../utils/psaUtils";

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

  // ---- PSA (total y libre): editables en ficha ----
  const [psaTotal, setPsaTotal] = useState("");
  const [psaLibre, setPsaLibre] = useState("");
  const [guardandoPSA, setGuardandoPSA] = useState(false);
  const [showPrintArea, setShowPrintArea] = useState(false);
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false);

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

  // Si el documento del paciente incluye un objeto `tacto`, mapearlo
  // a los estados locales del formulario para que al abrir la ficha
  // se vean las características previamente guardadas.
  useEffect(() => {
    if (!paciente) return;
    const t = paciente.tacto;
    if (!t) return;

    try {
      // Tamaño puede venir como 'tamanio' (desde Tacto.jsx) o 'tamano'
      setTamano(t.tamanio || t.tamano || "II");

      setCarFibroelastica(!!t.fibroelastica);
      setCarAumentadaConsistencia(!!t.aumentadaConsistencia);
      setCarPetrea(!!t.petrea);

      setBordes(t.bordes || "regulares");

      // Nódulos: el formato puede ser string 'si'/'no' (t.nodulos)
      // o un objeto { presencia:'si', derecho: true, izquierdo: false }
      if (typeof t.nodulos === "string") {
        setNodulosPresencia(t.nodulos);
        setNoduloDerecho(t.ladoNodulo === "derecho");
        setNoduloIzquierdo(t.ladoNodulo === "izquierdo");
      } else if (typeof t.nodulos === "object" && t.nodulos !== null) {
        setNodulosPresencia(t.nodulos.presencia || "no");
        setNoduloDerecho(!!t.nodulos.derecho);
        setNoduloIzquierdo(!!t.nodulos.izquierdo);
      } else {
        setNodulosPresencia("no");
        setNoduloDerecho(false);
        setNoduloIzquierdo(false);
      }

      // Si el guardado original usó 'ladoNodulo' (cadena), también respetarlo
      if (!t.nodulos && t.ladoNodulo) {
        setNodulosPresencia("si");
        setNoduloDerecho(t.ladoNodulo === "derecho");
        setNoduloIzquierdo(t.ladoNodulo === "izquierdo");
      }

      setPlanosClivaje(t.planosClivaje || "si");
    } catch (err) {
      console.warn("No se pudieron mapear los datos de tacto:", err);
    }
  }, [paciente]);

  // Sincronizar PSA desde el paciente
  useEffect(() => {
    if (!paciente) return;
    setPsaTotal(paciente.psaTotal ?? "");
    setPsaLibre(paciente.psaLibre ?? "");
  }, [paciente]);

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

  const handleGuardarPSA = async (e) => {
    e.preventDefault();
    if (!paciente) return;
    setGuardandoPSA(true);
    try {
      const ref = doc(db, "pacientes", paciente.id);
      await updateDoc(ref, {
        psaTotal: psaTotal.trim() || null,
        psaLibre: psaLibre.trim() || null,
      });
      setPaciente((prev) => prev ? { ...prev, psaTotal: psaTotal.trim() || null, psaLibre: psaLibre.trim() || null } : prev);
    } catch (err) {
      console.error("Error guardando PSA:", err);
    } finally {
      setGuardandoPSA(false);
    }
  };

  // Contenido para impresión: tacto + PSA
  const tacto = paciente?.tacto;
  const printContent = paciente && (
    <div className="print-results-content" id="print-results-area">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <button type="button" onClick={() => setShowPrintArea(false)} className="btn-close-print">Cerrar</button>
        <button type="button" onClick={() => window.print()} className="btn-print">Imprimir</button>
      </div>
      <h1 style={{ marginBottom: "0.5rem" }}>Resultados – {paciente.nombreCompleto}</h1>
      <p><strong>Cédula:</strong> {paciente.cedula} &nbsp;|&nbsp; <strong>Edad:</strong> {paciente.edad ?? "-"} años</p>
      <hr style={{ margin: "1rem 0" }} />
      <h2 style={{ fontSize: "1.1rem", marginTop: "1rem" }}>Evaluación de tacto rectal</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <tbody>
          <tr><td><strong>Tamaño</strong></td><td>{tacto?.tamanio || tacto?.tamano || "-"}</td></tr>
          <tr><td><strong>Consistencia</strong></td><td>
            {[tacto?.fibroelastica && "Fibroelástica", tacto?.aumentadaConsistencia && "Aumentada", tacto?.petrea && "Pétrea"].filter(Boolean).join(", ") || "Normal"}
          </td></tr>
          <tr><td><strong>Bordes</strong></td><td>{tacto?.bordes || "-"}</td></tr>
          <tr><td><strong>Nódulos</strong></td><td>{tacto?.nodulos === "si" ? `Sí${tacto?.ladoNodulo ? ` (${tacto.ladoNodulo})` : ""}` : "No"}</td></tr>
          <tr><td><strong>Planos de clivaje</strong></td><td>{tacto?.planosClivaje === "si" ? "Sí" : tacto?.planosClivaje ? "No" : "-"}</td></tr>
        </tbody>
      </table>
      <h2 style={{ fontSize: "1.1rem", marginTop: "1.25rem" }}>PSA (laboratorio)</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <tbody>
          <tr><td><strong>PSA total (ng/ml)</strong></td><td>{(psaTotal.trim() || paciente.psaTotal) ?? "-"}</td></tr>
          <tr><td><strong>PSA libre (ng/ml)</strong></td><td>{(psaLibre.trim() || paciente.psaLibre) ?? "-"}</td></tr>
          <tr><td><strong>PSA libre/total (%)</strong></td><td>
            {(() => {
              const total = psaTotal.trim() || paciente.psaTotal;
              const libre = psaLibre.trim() || paciente.psaLibre;
              if (getPSALibrePercent(total, libre) == null || !shouldShowPSALibreRelation(total)) return "-";
              return `${getPSALibrePercent(total, libre)}%`;
            })()}
          </td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "#666" }}>
        Impreso el {new Date().toLocaleString("es")} – Hospital Domingo Luciani – Proyecto Zoriak
      </p>
      {/* Confirmar entrega (no se imprime) */}
      <div className="no-print" style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
        <p style={{ marginBottom: "0.5rem", fontWeight: 600 }}>
          {paciente.entregaResultados === "entregado"
            ? "✓ Resultados entregados"
            : "Estado: Pendiente por retiro"}
        </p>
        {paciente.entregaResultados !== "entregado" && (
          <button
            type="button"
            disabled={confirmandoEntrega}
            onClick={async () => {
              setConfirmandoEntrega(true);
              try {
                const ref = doc(db, "pacientes", paciente.id);
                await updateDoc(ref, {
                  entregaResultados: "entregado",
                  entregaResultadosAt: serverTimestamp(),
                });
                setPaciente((prev) => ({ ...prev, entregaResultados: "entregado", entregaResultadosAt: new Date() }));
              } catch (e) {
                console.error(e);
              } finally {
                setConfirmandoEntrega(false);
              }
            }}
            style={{ padding: "0.5rem 1rem", background: "#059669", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            {confirmandoEntrega ? "Guardando..." : "Confirmar entrega"}
          </button>
        )}
      </div>
    </div>
  );

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
      {showPrintArea && (
        <div className="print-overlay" role="dialog" aria-label="Vista de impresión">
          <div className="print-overlay-inner">
            {printContent}
          </div>
        </div>
      )}
      <button onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        ⬅ Volver
      </button>

      {/* Datos principales del paciente */}
      <section className="paciente-detalle-header">
        <h1>{paciente.nombreCompleto}</h1>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Cédula:</strong> {paciente.cedula}
        </p>
        {/* Mostrar información del profesional que realizó el último tacto, si existe */}
        {paciente.tacto && (paciente.tacto.medicoEmail || paciente.tacto.medicoId) && (
          <p style={{ margin: "0.25rem 0", color: "#cbd5f5" }}>
            <strong>Evaluación (tacto) realizada por:</strong>{' '}
            {paciente.tacto.medicoEmail || paciente.tacto.medicoId}
            {paciente.tacto.actualizadoEn && (
              <span> • {formatFecha(paciente.tacto.actualizadoEn)}</span>
            )}
          </p>
        )}
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Edad:</strong> {paciente.edad ?? "-"} años
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Localidad:</strong> {paciente.localidad || "-"}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Correo:</strong> {paciente.email || "-"}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Entrega resultados:</strong>{" "}
          <span style={{ color: paciente.entregaResultados === "entregado" ? "#10b981" : "#f59e0b" }}>
            {paciente.entregaResultados === "entregado" ? "Entregado" : "Pendiente por retiro"}
          </span>
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>PSA total:</strong> {paciente.psaTotal ?? "-"} ng/ml &nbsp;|&nbsp; <strong>PSA libre:</strong> {paciente.psaLibre ?? "-"} ng/ml
          {getPSALibrePercent(paciente.psaTotal, paciente.psaLibre) != null && shouldShowPSALibreRelation(paciente.psaTotal) && (
            <> &nbsp;|&nbsp; <strong>PSA libre/total:</strong> {getPSALibrePercent(paciente.psaTotal, paciente.psaLibre)}%{getPSALibreInterpretation(paciente.psaTotal, paciente.psaLibre)}</>
          )}
        </p>
      </section>

      {/* Editar PSA y botón Imprimir */}
      <section style={{ marginBottom: "1rem", padding: "1rem", background: "var(--bg-soft)", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.25)" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Resultados de laboratorio (PSA)</h2>
        <form onSubmit={handleGuardarPSA} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>PSA total (ng/ml)</label>
            <input type="text" value={psaTotal} onChange={(e) => setPsaTotal(e.target.value)} placeholder="Ej. 2.5" style={{ width: "120px", padding: "0.4rem 0.6rem" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>PSA libre (ng/ml)</label>
            <input type="text" value={psaLibre} onChange={(e) => setPsaLibre(e.target.value)} placeholder="Ej. 0.8" style={{ width: "120px", padding: "0.4rem 0.6rem" }} />
          </div>
          <button type="submit" disabled={guardandoPSA} style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
            {guardandoPSA ? "Guardando..." : "Guardar PSA"}
          </button>
          <button type="button" onClick={() => setShowPrintArea(true)} style={{ padding: "0.5rem 1rem", background: "#059669", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
            Imprimir resultados (tacto + PSA)
          </button>
        </form>
        {getPSALibrePercent(psaTotal || paciente.psaTotal, psaLibre || paciente.psaLibre) != null && shouldShowPSALibreRelation(psaTotal || paciente.psaTotal) && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
            <strong>PSA libre/total:</strong> {getPSALibrePercent(psaTotal || paciente.psaTotal, psaLibre || paciente.psaLibre)}%
            {getPSALibreInterpretation(psaTotal || paciente.psaTotal, psaLibre || paciente.psaLibre)}
          </p>
        )}
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
            <div className="table-wrapper table-scroll">
              <table className="pacientes-table">
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
