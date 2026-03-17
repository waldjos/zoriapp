// src/pages/MiniJornada.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import ProsilodBanner from "../components/ProsilodBanner";
import { useAuth } from "../context/AuthContext.jsx";
import { formatoNombre, formatoCedula, nombreParaBusqueda } from "../utils/formatoPaciente";

export default function MiniJornada() {
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

  // Cargar pacientes una vez, solo los de la mini jornada (desde medianoche hoy)
  useEffect(() => {
    const cargarPacientes = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Medianoche del día actual

        const q = collection(db, "pacientes");
        const snapshot = await getDocs(q);
        const allDatos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Filtrar en cliente por createdAt >= today
        const datos = allDatos.filter((p) => {
          if (!p.createdAt || !p.createdAt.toDate) return false;
          const createdAtDate = p.createdAt.toDate();
          return createdAtDate >= today;
        });
        setPacientes(datos);
      } catch (error) {
        console.error("Error al cargar pacientes:", error);
      }
    };

    cargarPacientes();
  }, []);

  // Filtrar por nombre o cédula
  const pacientesFiltrados = useMemo(() => {
    const term = busqueda.trim();
    if (!term) return pacientes;
    const termNombre = nombreParaBusqueda(term);
    const termDigitos = formatoCedula(term);
    return pacientes.filter((p) => {
      const nombreTexto = p.nombreCompleto ?? p.nombre ?? "";
      const nombreBusqueda = nombreParaBusqueda(nombreTexto);
      const cedula = formatoCedula(p.cedula);
      const coincideNombre =
        nombreBusqueda.includes(termNombre) ||
        (termNombre.length > 0 && termNombre.split(/\s+/).every((palabra) => nombreBusqueda.includes(palabra)));
      const coincideCedula = termDigitos.length > 0 && cedula.includes(termDigitos);
      return coincideNombre || coincideCedula;
    });
  }, [pacientes, busqueda]);

  const seleccionarPaciente = (paciente) => {
    try {
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
    } catch (error) {
      console.error("Error al seleccionar paciente:", error);
      setMensaje("Error al cargar la evaluación del paciente.");
    }
  };

  const handleChangeRadio = (campo, valor) => {
    setEvaluacion((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleChangeCheck = (campo) => {
    setEvaluacion((prev) => ({ ...prev, [campo]: !prev[campo] }));
  };

  const handleChangeText = (campo, valor) => {
    setEvaluacion((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!seleccionado) return;

    setGuardando(true);
    setMensaje("");

    try {
      const ref = doc(db, "pacientes", seleccionado.id);
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

  const enviarMensajeEmail = () => {
    if (!seleccionado || !seleccionado.email) {
      alert("No hay paciente seleccionado o no tiene correo electrónico.");
      return;
    }

    // Construir el mensaje (igual que WhatsApp)
    let mensaje = `Buen Día, ${formatoNombre(seleccionado.nombreCompleto)}, gusto en saludarte.\nTe envío el resumen de la Consulta Urológica 2025\n\nExamen Físico: Tacto: `;

    // Grado
    mensaje += `Grado ${evaluacion.tamanio || 'N/A'}`;

    // Consistencia
    const consistencias = [];
    if (evaluacion.fibroelastica) consistencias.push("Fibroelástica");
    if (evaluacion.aumentadaConsistencia) consistencias.push("Aumentada de consistencia");
    if (evaluacion.petrea) consistencias.push("Pétrea");
    mensaje += `, Consistencia: ${consistencias.length > 0 ? consistencias.join(", ") : 'Normal'}`;

    // Nódulo
    mensaje += `, Nódulo: ${evaluacion.nodulos === 'si' ? 'Sí' : 'No'}`;
    if (evaluacion.nodulos === 'si' && evaluacion.ladoNodulo) {
      mensaje += ` (${evaluacion.ladoNodulo})`;
    }

    mensaje += '\n\nDra. Milagro Tapia Cirujano Urologo';

    // Codificar mensaje
    const subject = encodeURIComponent("Resumen de Consulta Urológica 2025");
    const body = encodeURIComponent(mensaje);

    // Abrir email
    const url = `mailto:${seleccionado.email}?subject=${subject}&body=${body}`;
    window.open(url, '_blank');
  };

  const enviarMensajeSMS = () => {
    if (!seleccionado || !seleccionado.telefono) {
      alert("No hay paciente seleccionado o no tiene teléfono.");
      return;
    }

    // Construir el mensaje (igual que WhatsApp, pero más corto para SMS)
    let mensaje = `Buen Día ${formatoNombre(seleccionado.nombreCompleto)}. Resumen Consulta Urológica 2025. Tacto: Grado ${evaluacion.tamanio || 'N/A'}, Consistencia: ${evaluacion.fibroelastica ? 'Fibroelástica' : 'Normal'}, Nódulo: ${evaluacion.nodulos === 'si' ? 'Sí' : 'No'}. Dra. Milagro Tapia Cirujano Urologo`;

    // Codificar mensaje
    const mensajeCodificado = encodeURIComponent(mensaje);

    // Abrir SMS
    const url = `sms:${seleccionado.telefono}?body=${mensajeCodificado}`;
    window.open(url, '_blank');
  };

  const enviarMensajeWhatsApp = () => {
    if (!seleccionado || !seleccionado.telefono) {
      alert("No hay paciente seleccionado o no tiene teléfono.");
      return;
    }

    // Construir el mensaje
    let mensaje = `Buen Día, ${formatoNombre(seleccionado.nombreCompleto)}, gusto en saludarte.\nTe envío el resumen de la Consulta Urológica 2025\n\nExamen Físico: Tacto: `;

    // Grado
    mensaje += `Grado ${evaluacion.tamanio || 'N/A'}`;

    // Consistencia
    const consistencias = [];
    if (evaluacion.fibroelastica) consistencias.push("Fibroelástica");
    if (evaluacion.aumentadaConsistencia) consistencias.push("Aumentada de consistencia");
    if (evaluacion.petrea) consistencias.push("Pétrea");
    mensaje += `, Consistencia: ${consistencias.length > 0 ? consistencias.join(", ") : 'Normal'}`;

    // Nódulo
    mensaje += `, Nódulo: ${evaluacion.nodulos === 'si' ? 'Sí' : 'No'}`;
    if (evaluacion.nodulos === 'si' && evaluacion.ladoNodulo) {
      mensaje += ` (${evaluacion.ladoNodulo})`;
    }

    mensaje += '\n\nDra. Milagro Tapia Cirujano Urologo 💙🩺';

    // Codificar mensaje
    const mensajeCodificado = encodeURIComponent(mensaje);

    // Abrir WhatsApp
    const url = `https://wa.me/${seleccionado.telefono}?text=${mensajeCodificado}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header-title">Mini Jornada Urológica</h1>
        <p className="page-header-subtitle">
          Busca al paciente por nombre o cédula y registra los hallazgos del tacto.
        </p>
      </div>

      {/* Buscador */}
      <div className="list-card">
        <div className="list-header">
          <div className="list-header-top">
            <div className="list-title">Buscar paciente</div>
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
                  <td>{formatoNombre(p.nombreCompleto)}</td>
                  <td>{formatoCedula(p.cedula)}</td>
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
            Evaluación de: {formatoNombre(seleccionado.nombreCompleto)}
          </h2>
          <p style={{ fontSize: "0.8rem", marginBottom: "0.9rem", color: "#9ca3af" }}>
            C.I.: {formatoCedula(seleccionado.cedula)} • Edad: {seleccionado.edad} • Tel: {seleccionado.telefono}
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

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="primary-btn"
                disabled={guardando}
                style={{ marginTop: "0.4rem" }}
              >
                {guardando ? "Guardando..." : "Guardar evaluación"}
              </button>
              <button
                type="button"
                onClick={enviarMensajeWhatsApp}
                style={{ backgroundColor: '#25d366', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.4rem' }}
              >
                Enviar WhatsApp
              </button>
              <button
                type="button"
                onClick={enviarMensajeEmail}
                style={{ backgroundColor: '#ea4335', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.4rem' }}
              >
                Enviar Email
              </button>
              <button
                type="button"
                onClick={enviarMensajeSMS}
                style={{ backgroundColor: '#34b7f1', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.4rem' }}
              >
                Enviar SMS
              </button>
            </div>
          </form>
        </div>
      )}
      <ProsilodBanner />
    </div>
  );
}