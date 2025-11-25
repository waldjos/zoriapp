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
  const [ocrRaw, setOcrRaw] = useState("");

  // Terminar worker al desmontar para liberar memoria
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Ejecuta OCR con varios niveles de preprocesado y elige la mejor salida
  const runOcrWithRetries = async (file) => {
    const attempts = [
      { contrast: 1.2, sharpen: false, maxWidth: 1200 }, // suave
      { contrast: 1.4, sharpen: true, maxWidth: 1600 }, // medio
      { contrast: 1.7, sharpen: true, maxWidth: 2000 }, // agresivo
    ];

    let best = { score: -1, text: '', cedula: null, nombre: null, fecha: null };

    for (let i = 0; i < attempts.length; i++) {
      const opts = attempts[i];
      try {
        setOcrProgress(Math.round((i / attempts.length) * 100));
        const processed = await (async (f, o) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const maxWidth = o.maxWidth || 1600;
              const scale = Math.min(1, maxWidth / img.width);
              const canvas = document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              // grayscale
              for (let k = 0; k < data.length; k += 4) {
                const r = data[k], g = data[k+1], b = data[k+2];
                const v = 0.299*r + 0.587*g + 0.114*b;
                data[k] = data[k+1] = data[k+2] = v;
              }
              // contrast
              const contrast = o.contrast || 1.2;
              for (let k = 0; k < data.length; k += 4) {
                let v = data[k];
                let nv = (v - 128) * contrast + 128;
                nv = Math.max(0, Math.min(255, nv));
                data[k] = data[k+1] = data[k+2] = nv;
              }
              ctx.putImageData(imageData, 0, 0);

              // optional sharpen
              if (o.sharpen) {
                const sctx = canvas.getContext('2d');
                const sData = sctx.getImageData(0,0,canvas.width, canvas.height);
                const sd = sData.data;
                const copy = new Uint8ClampedArray(sd);
                const w = canvas.width, h = canvas.height;
                for (let y = 1; y < h-1; y++) {
                  for (let x = 1; x < w-1; x++) {
                    const idx = (y*w + x)*4;
                    const center = copy[idx];
                    const north = copy[idx - w*4];
                    const south = copy[idx + w*4];
                    const west = copy[idx - 4];
                    const east = copy[idx + 4];
                    let val = center*5 - north - south - west - east;
                    val = Math.max(0, Math.min(255, val));
                    sd[idx] = sd[idx+1] = sd[idx+2] = val;
                  }
                }
                sctx.putImageData(sData, 0, 0);
                sctx.canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
              } else {
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
              }
            };
            img.onerror = reject;
            const reader = new FileReader();
            reader.onload = (ev) => (img.src = ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          });
        })(file, opts);

        const worker = workerRef.current;
        const { data: { text } } = await worker.recognize(processed);
        const raw = (text || '').replace(/\t/g, ' ');
        // parse
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let cedulaFound = null;
        for (const line of lines) {
          const m = line.match(/\b([VEJPG]\-?\s?\d{6,10}|\d{6,10})\b/i);
          if (m) { cedulaFound = m[0].replace(/\s|\-/g, ''); break; }
        }
        let fechaFound = null;
        for (const line of lines) {
          const fm = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})|(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
          if (fm) { fechaFound = fm[0]; break; }
        }
        let nombreFound = null;
        for (const line of lines) {
          const clean = line.replace(/[\d\W_]+/g, ' ').trim();
          if (clean.length >= 6 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clean) && clean.split(' ').length >= 2) {
            nombreFound = clean; break;
          }
        }

        // scoring
        let score = 0;
        if (cedulaFound) score += 100;
        if (nombreFound) score += 20;
        if (fechaFound) score += 10;
        // prefer longer OCR outputs a bit
        score += Math.min(10, raw.length / 100);

        if (score > best.score) {
          best = { score, text: raw, cedula: cedulaFound, nombre: nombreFound, fecha: fechaFound };
        }

        // if we already have cedula, stop early
        if (best.cedula) break;
      } catch (err) {
        console.error('attempt OCR error', err);
      }
    }

    setOcrProgress(100);
    return best;
  };

  // Llamar al endpoint serverless que reenvía a OCR.space
  const callOcrSpaceServer = async (file) => {
    const readAsDataURL = (f) => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });

    const dataUrl = await readAsDataURL(file);
    // Enviar al endpoint local /api/ocr-space
    const resp = await fetch('/api/ocr-space', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl }),
    });
    if (!resp.ok) throw new Error('OCR.space proxy failed');
    const json = await resp.json();
    const parsed = json?.ParsedResults?.[0]?.ParsedText || '';
    const raw = (parsed || '').replace(/\t/g, ' ');
    // extraer campos iguales a la lógica local
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let cedulaFound = null;
    for (const line of lines) {
      const m = line.match(/\b([VEJPG]\-?\s?\d{6,10}|\d{6,10})\b/i);
      if (m) { cedulaFound = m[0].replace(/\s|\-/g, ''); break; }
    }
    let fechaFound = null;
    for (const line of lines) {
      const fm = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})|(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
      if (fm) { fechaFound = fm[0]; break; }
    }
    let nombreFound = null;
    for (const line of lines) {
      const clean = line.replace(/[\d\W_]+/g, ' ').trim();
      if (clean.length >= 6 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clean) && clean.split(' ').length >= 2) {
        nombreFound = clean; break;
      }
    }

    return { text: raw, cedula: cedulaFound, fecha: fechaFound, nombre: nombreFound };
  };

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

                // Preprocesar imagen: escalar, convertir a gris y aplicar contraste y sharpen
                const preprocess = async (file, opts = {contrast: 1.1, sharpen: true, maxWidth: 1600}) => {
                  return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                      const maxWidth = opts.maxWidth || 1600;
                      const scale = Math.min(1, maxWidth / img.width);
                      const canvas = document.createElement('canvas');
                      canvas.width = Math.round(img.width * scale);
                      canvas.height = Math.round(img.height * scale);
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                      // grayscale
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const data = imageData.data;
                      for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const v = 0.299 * r + 0.587 * g + 0.114 * b;
                        data[i] = data[i + 1] = data[i + 2] = v;
                      }

                      // contrast adjust
                      const contrast = opts.contrast || 1.1;
                      for (let i = 0; i < data.length; i += 4) {
                        let v = data[i];
                        let nv = (v - 128) * contrast + 128;
                        nv = Math.max(0, Math.min(255, nv));
                        data[i] = data[i + 1] = data[i + 2] = nv;
                      }

                      ctx.putImageData(imageData, 0, 0);

                      // optional sharpen (unsharp mask simple)
                      if (opts.sharpen) {
                        const sharpenCanvas = document.createElement('canvas');
                        sharpenCanvas.width = canvas.width;
                        sharpenCanvas.height = canvas.height;
                        const sctx = sharpenCanvas.getContext('2d');
                        sctx.drawImage(canvas, 0, 0);
                        const sData = sctx.getImageData(0, 0, canvas.width, canvas.height);
                        const sd = sData.data;
                        // 3x3 kernel: [[0,-1,0],[-1,5,-1],[0,-1,0]]
                        const w = canvas.width;
                        const h = canvas.height;
                        const copy = new Uint8ClampedArray(sd);
                        for (let y = 1; y < h - 1; y++) {
                          for (let x = 1; x < w - 1; x++) {
                            const idx = (y * w + x) * 4;
                            // center*5 - north - south - east - west
                            const center = copy[idx];
                            const north = copy[idx - w * 4];
                            const south = copy[idx + w * 4];
                            const west = copy[idx - 4];
                            const east = copy[idx + 4];
                            let val = center * 5 - north - south - west - east;
                            val = Math.max(0, Math.min(255, val));
                            sd[idx] = sd[idx + 1] = sd[idx + 2] = val;
                          }
                        }
                        sctx.putImageData(sData, 0, 0);
                        sctx.canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
                      } else {
                        canvas.toBlob((blob) => {
                          resolve(blob);
                        }, 'image/jpeg', 0.9);
                      }
                    };
                    img.onerror = reject;
                    const reader = new FileReader();
                    reader.onload = (ev) => (img.src = ev.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                };

                try {
                  // intentar con parámetros estándar
                  const processed = await preprocess(file, {contrast:1.3, sharpen:true, maxWidth:1600});
                  const worker = workerRef.current;
                  const { data: { text } } = await worker.recognize(processed);
                  setOcrRaw(text || '');

                  // Normalizar texto y dividir líneas
                  const raw = (text || '').replace(/\t/g,' ');
                  setOcrRaw(raw);
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
                  // Si no encontramos cédula con Tesseract, intentar fallback con OCR.space (serverless)
                  if (!cedulaFound) {
                    try {
                      setOcrLoading(true);
                      const serverRes = await callOcrSpaceServer(file);
                      if (serverRes?.cedula) setCedula(serverRes.cedula);
                      if (serverRes?.fecha) setFechaNacimiento(serverRes.fecha);
                      if (serverRes?.nombre) setNombreCompleto(serverRes.nombre);
                      if (serverRes?.text) setOcrRaw((prev) => (prev ? prev + '\n\n--- OCR.space ---\n' + serverRes.text : serverRes.text));
                    } catch (srvErr) {
                      console.error('OCR.space fallback error', srvErr);
                    }
                  }
                } catch (err) {
                  console.error('OCR error:', err);
                  setOcrError('No se pudo extraer datos del documento. Intenta con una foto más clara y bien iluminada. Puedes ver el texto OCR detectado más abajo.');
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

          {/* Mostrar texto OCR bruto para depuración y permitir reintento */}
          {ocrRaw && (
            <div style={{ marginTop: '0.6rem' }}>
              <label>Texto OCR detectado (revisa y corrige si hace falta)</label>
              <textarea value={ocrRaw} readOnly rows={6} style={{ width: '100%', marginTop: '0.35rem' }} />
            </div>
          )}

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
