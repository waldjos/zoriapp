// src/pages/Pacientes.jsx
import { useEffect, useState } from "react";
import { createWorker } from "tesseract.js";
import { useRef } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import ProsilodBanner from "../components/ProsilodBanner";

export default function Pacientes() {
  // Campos del formulario
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [edad, setEdad] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const workerRef = useRef(null);

  // Terminar worker al desmontar para liberar memoria
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lista de pacientes
  const [pacientes, setPacientes] = useState([]);
  const [cargandoPacientes, setCargandoPacientes] = useState(true);

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState("");

  // Edición
  const [editingId, setEditingId] = useState(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Escuchar en tiempo real la colección "pacientes"
  useEffect(() => {
    const q = query(
      collection(db, "pacientes"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setPacientes(lista);
        setCargandoPacientes(false);
      },
      (err) => {
        console.error("Error obteniendo pacientes:", err);
        setCargandoPacientes(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const limpiarFormulario = () => {
    setNombreCompleto("");
    setCedula("");
    setTelefono("");
    setLocalidad("");
    setEdad("");
    setFechaNacimiento("");
    setEmail("");
    setNotas("");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (!user) {
        throw new Error("No hay usuario autenticado.");
      }

      if (!nombreCompleto.trim() || !cedula.trim()) {
        setError("Nombre completo y cédula son obligatorios.");
        setSubmitting(false);
        return;
      }

      // Validación simple de email si se envía
      if (email.trim() && !email.includes("@")) {
        setError("El correo electrónico no es válido.");
        setSubmitting(false);
        return;
      }

      const edadNumero =
        edad.trim() === "" ? null : Number.parseInt(edad.trim(), 10);

      const dataPaciente = {
        nombreCompleto: nombreCompleto.trim(),
        cedula: cedula.trim(),
        telefono: telefono.trim(),
        localidad: localidad.trim(),
        edad: isNaN(edadNumero) ? null : edadNumero,
        fechaNacimiento: fechaNacimiento.trim(),
        email: email.trim(),
        notas: notas.trim(),
      };

      if (editingId) {
        // 🔄 Actualizar paciente existente
        const ref = doc(db, "pacientes", editingId);
        await updateDoc(ref, {
          ...dataPaciente,
          updatedAt: serverTimestamp(),
        });
        setSuccess("Paciente actualizado correctamente.");
      } else {
        // ➕ Crear nuevo paciente
        await addDoc(collection(db, "pacientes"), {
          ...dataPaciente,
          createdAt: serverTimestamp(),
          creadoPor: user.uid,
        });
        setSuccess("Paciente registrado correctamente.");
      }

      limpiarFormulario();
    } catch (err) {
      console.error("Error guardando paciente:", err);
      setError("No se pudo registrar el paciente.");
    } finally {
      setSubmitting(false);
    }
  };

  const irADetalle = (idPaciente) => {
    navigate(`/pacientes/${idPaciente}`);
  };

  const empezarEdicion = (paciente) => {
    setNombreCompleto(paciente.nombreCompleto || "");
    setCedula(paciente.cedula || "");
    setTelefono(paciente.telefono || "");
    setLocalidad(paciente.localidad || "");
    setEdad(paciente.edad != null ? String(paciente.edad) : "");
    setEmail(paciente.email || "");
    setNotas(paciente.notas || "");
    setEditingId(paciente.id);
    setError("");
    setSuccess("");
  };

  const cancelarEdicion = () => {
    limpiarFormulario();
    setError("");
    setSuccess("");
  };

  const eliminarPaciente = async (idPaciente) => {
    const confirmar = window.confirm(
      "¿Seguro que deseas eliminar este paciente? Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    try {
      const ref = doc(db, "pacientes", idPaciente);
      await deleteDoc(ref);
    } catch (err) {
      console.error("Error eliminando paciente:", err);
      alert("No se pudo eliminar el paciente.");
    }
  };

  // Filtrado por búsqueda (nombre o cédula)
  const pacientesFiltrados = pacientes.filter((p) => {
    const termino = searchTerm.toLowerCase();
    if (!termino) return true;

    const nombre = (p.nombreCompleto || "").toLowerCase();
    const ced = (p.cedula || "").toLowerCase();

    return nombre.includes(termino) || ced.includes(termino);
  });

  return (
    <div className="page pacientes-page pacientes-card">
      {/* FORMULARIO DE REGISTRO / EDICIÓN */}
      <section className="form-card">
        <h1 className="page-header-title">Pacientes</h1>
        <p className="page-header-subtitle">Registra y administra los pacientes de la jornada.</p>

        <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
          {/* Captura de documento de identidad */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Capturar foto de documento de identidad</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async (e) => {
                setOcrError("");
                setOcrProgress(0);
                setOcrLoading(true);
                const file = e.target.files[0];
                if (!file) {
                  setOcrLoading(false);
                  return;
                }

                // Inicializar worker si es necesario
                if (!workerRef.current) {
                  const worker = createWorker({
                    logger: (m) => {
                      if (m.status === 'recognizing text' && m.progress) {
                        setOcrProgress(Math.round(m.progress * 100));
                      }
                    },
                  });
                  workerRef.current = worker;
                  try {
                    await worker.load();
                    await worker.loadLanguage('spa');
                    await worker.initialize('spa');
                    await worker.setParameters({
                      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÑñ -/.,',
                      tessedit_pageseg_mode: '6',
                    });
                  } catch (initErr) {
                    console.error('Error inicializando OCR worker:', initErr);
                    setOcrError('Error al inicializar OCR.');
                    setOcrLoading(false);
                    return;
                  }
                }

                // Preprocesar imagen: escalar, convertir a gris y aplicar contraste ligero
                const preprocess = async (file) => {
                  return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                      const maxWidth = 1600;
                      const scale = Math.min(1, maxWidth / img.width);
                      const canvas = document.createElement('canvas');
                      canvas.width = Math.round(img.width * scale);
                      canvas.height = Math.round(img.height * scale);
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                      // grayscale + increase contrast
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const data = imageData.data;
                      // simple contrast/stretch
                      const contrast = 1.1; // small boost
                      for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const v = 0.299 * r + 0.587 * g + 0.114 * b;
                        let nv = (v - 128) * contrast + 128;
                        nv = Math.max(0, Math.min(255, nv));
                        data[i] = data[i + 1] = data[i + 2] = nv;
                      }
                      ctx.putImageData(imageData, 0, 0);
                      canvas.toBlob((blob) => {
                        resolve(blob);
                      }, 'image/jpeg', 0.9);
                    };
                    img.onerror = reject;
                    const reader = new FileReader();
                    reader.onload = (ev) => (img.src = ev.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                };

                try {
                  const processed = await preprocess(file);
                  const worker = workerRef.current;
                  const { data: { text } } = await worker.recognize(processed);

                  // Normalizar texto y dividir líneas
                  const raw = text || '';
                  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

                  // Buscar cédula: puede venir con letras delante (V, E, J) o solo números
                  let cedulaFound = null;
                  for (const line of lines) {
                    const m = line.match(/\b([VEJPG]\-?\s?\d{6,10}|\d{6,10})\b/i);
                    if (m) { cedulaFound = m[0].replace(/\s|\-/g, ''); break; }
                  }
                  if (cedulaFound) setCedula(cedulaFound);

                  // Buscar fecha: dd/mm/yyyy o yyyy-mm-dd
                  let fechaFound = null;
                  for (const line of lines) {
                    const fm = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})|(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
                    if (fm) { fechaFound = fm[0]; break; }
                  }
                  if (fechaFound) setFechaNacimiento(fechaFound);

                  // Buscar nombre: línea con letras > 6 caracteres y al menos un espacio, preferentemente en mayúsculas
                  let nombreFound = null;
                  for (const line of lines) {
                    const clean = line.replace(/[\d\W_]+/g, ' ').trim();
                    if (clean.length >= 6 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clean) && clean.split(' ').length >= 2) {
                      nombreFound = clean;
                      break;
                    }
                  }
                  if (nombreFound) setNombreCompleto(nombreFound);
                } catch (err) {
                  console.error('OCR error:', err);
                  setOcrError('No se pudo extraer datos del documento. Intenta con una foto más clara y bien iluminada.');
                }

                setOcrLoading(false);
              }}
            />
            {ocrLoading && <p style={{ color: "#5CC52E" }}>Procesando imagen...</p>}
            {ocrError && <p style={{ color: "red" }}>{ocrError}</p>}
          </div>
          {/* Nombre */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Nombre completo *</label>
            <input
              type="text"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              required
            />
          </div>

          {/* Cédula */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Cédula / Documento *</label>
            <input
              type="text"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              required
            />
          </div>

          {/* Teléfono */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="paciente@correo.com"
            />
          </div>

          {/* Localidad */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Localidad</label>
            <input
              type="text"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              placeholder="Ciudad / Hospital / Estado"
            />
          </div>

          {/* Edad */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Edad</label>
            <input
              type="number"
              min="0"
              max="120"
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
            />
          </div>
          {/* Fecha de nacimiento */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Notas (motivo, hallazgos, etc.)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              style={{ resize: "vertical" }}
            />
          </div>

          {error && <p className="status-error">{error}</p>}
          {success && <p className="status-ok">{success}</p>}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: "var(--primary)", color: "#020617" }}
            >
              {submitting ? (editingId ? "Guardando cambios..." : "Guardando...") : (editingId ? "Actualizar paciente" : "Registrar paciente")}
            </button>

            {editingId && (
              <button type="button" onClick={cancelarEdicion} style={{ backgroundColor: "#6b7280" }}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>

      {/* LISTADO DE PACIENTES */}
      <section className="list-card" style={{ marginTop: "1rem" }}>
        <div className="list-header">
          <div className="list-header-top">
            <div>
              <h2 className="list-title">Lista de pacientes</h2>
              {!cargandoPacientes && (
                <p className="page-header-subtitle" style={{ marginTop: "6px" }}>
                  Total de pacientes registrados: <strong>{pacientes.length}</strong>
                  {searchTerm && (<> | Coincidencias: <strong>{pacientesFiltrados.length}</strong></>)}
                </p>
              )}
            </div>

            <input
              type="text"
              placeholder="Buscar por nombre o cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {cargandoPacientes ? (
          <p style={{ marginTop: "1rem" }}>Cargando pacientes...</p>
        ) : pacientesFiltrados.length === 0 ? (
          <p style={{ marginTop: "1rem" }}>No hay pacientes registrados aún.</p>
        ) : (
          <div className="table-wrapper table-scroll" style={{ marginTop: "0.6rem" }}>
            <table className="pacientes-table" role="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cédula</th>
                  <th>Localidad</th>
                  <th>Edad</th>
                  <th>Correo</th>
                  <th style={{ textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nombreCompleto}</td>
                    <td>{p.cedula}</td>
                    <td>{p.localidad || "-"}</td>
                    <td>{p.edad ?? "-"}</td>
                    <td>{p.email || "-"}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <div className="actions-cell">
                        <button onClick={() => irADetalle(p.id)} style={{ backgroundColor: "#2563eb" }}>Ver ficha</button>
                        <button onClick={() => empezarEdicion(p)} style={{ backgroundColor: "#10b981" }}>Editar</button>
                        <button onClick={() => eliminarPaciente(p.id)} style={{ backgroundColor: "var(--danger)" }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProsilodBanner />
    </div>
  );
}
