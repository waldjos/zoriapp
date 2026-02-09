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
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import ProsilodBanner from "../components/ProsilodBanner";
import { getPSALibrePercent, getPSALibreInterpretation, shouldShowPSALibreRelation } from "../utils/psaUtils";
import { formatoNombre, formatoCedula, normalizarParaBusqueda } from "../utils/formatoPaciente";

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
  const [estadoResultado, setEstadoResultado] = useState("pendiente");
  const [psaTotal, setPsaTotal] = useState("");
  const [psaLibre, setPsaLibre] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const workerRef = useRef(null);
  const [ocrRaw, setOcrRaw] = useState("");
  const [extractedNotice, setExtractedNotice] = useState(null);

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

  // Handler que intenta OCR.space primero y luego Tesseract si hace falta
  const handleFileInput = async (file) => {
    setOcrError("");
    setOcrProgress(0);
    setOcrLoading(true);
    try {
      // intentar servidor primero
      try {
        const serverRes = await callOcrSpaceServer(file);
        if (serverRes) {
          if (serverRes.cedula) setCedula(serverRes.cedula);
          if (serverRes.nombre) setNombreCompleto(serverRes.nombre);
          if (serverRes.fecha) setFechaNacimiento(serverRes.fecha);
          if (serverRes.text) setOcrRaw(serverRes.text);
          setExtractedNotice({ source: 'OCR.space', ...serverRes });
        }
      } catch (srvErr) {
        console.warn('OCR.space call failed', srvErr);
      }

      // si no se detectó cédula o nombre, intentar local
      if (!cedula || !nombreCompleto) {
        if (!workerRef.current) {
          const worker = createWorker({
            logger: (m) => {
              if (m.status === 'recognizing text' && m.progress) setOcrProgress(Math.round(m.progress * 100));
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
          }
        }

        try {
          const best = await runOcrWithRetries(file);
          if (best) {
            if (best.cedula && !cedula) setCedula(best.cedula);
            if (best.nombre && !nombreCompleto) setNombreCompleto(best.nombre);
            if (best.fecha && !fechaNacimiento) setFechaNacimiento(best.fecha);
            if (best.text) setOcrRaw((prev) => (prev ? prev + '\n\n--- Tesseract ---\n' + best.text : best.text));
            setExtractedNotice((prev) => prev ? ({ ...prev, tesseract: best }) : ({ source: 'Tesseract', ...best }));
          }
        } catch (err) {
          console.error('Local OCR retries failed', err);
        }
      }
    } catch (err) {
      console.error('handleFileInput error', err);
      setOcrError('Error procesando la imagen.');
    } finally {
      setOcrLoading(false);
    }
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

  // Envío de SMS
  const [enviandoSMS, setEnviandoSMS] = useState(false);
  const [mensajeSMS, setMensajeSMS] = useState("");

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
    setPsaTotal("");
    setPsaLibre("");
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
        nombreCompleto: formatoNombre(nombreCompleto),
        cedula: formatoCedula(cedula),
        telefono: telefono.trim(),
        localidad: localidad.trim(),
        edad: isNaN(edadNumero) ? null : edadNumero,
        fechaNacimiento: fechaNacimiento.trim(),
        email: email.trim(),
        notas: notas.trim(),
        psaTotal: psaTotal.trim() || null,
        psaLibre: psaLibre.trim() || null,
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
    setEstadoResultado(paciente.estadoResultado || "pendiente");
    setPsaTotal(paciente.psaTotal ?? "");
    setPsaLibre(paciente.psaLibre ?? "");
    setEditingId(paciente.id);
    setError("");
    setSuccess("");
  };

  const cancelarEdicion = () => {
    limpiarFormulario();
    setError("");
    setSuccess("");
  };

  // Filtrado por búsqueda (nombre o cédula) — comparación normalizada y sin acentos
  const pacientesFiltrados = pacientes.filter((p) => {
    const termino = searchTerm.trim();
    if (!termino) return true;

    const nombreBusqueda = normalizarParaBusqueda(p.nombreCompleto);
    const ced = formatoCedula(p.cedula);
    const terminoNombre = normalizarParaBusqueda(termino);
    const terminoDigitos = formatoCedula(termino);

    return nombreBusqueda.includes(terminoNombre) || ced.includes(terminoDigitos);
  });

  // Exportar pacientes simplificado: solo campos del registro (nombre + datos de registro)
  const getExportList = () => (searchTerm ? pacientesFiltrados : pacientes);

  // Columnas a mostrar/exportar: clave y etiqueta en español
  const exportColumns = [
    { key: 'nombreCompleto', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'edad', label: 'Edad' },
    { key: 'localidad', label: 'Localidad' },
  ];

  const [showListBox, setShowListBox] = useState(false);

  const exportToCSV = () => {
    const list = getExportList();
    if (!list || list.length === 0) {
      alert('No hay pacientes para exportar.');
      return;
    }

    const headers = exportColumns.map((c) => c.label);
    const keys = exportColumns.map((c) => c.key);
    const csvLines = [headers.map((h) => `"${h}"`).join(',')];
    list.forEach((p) => {
      const row = keys.map((f) => {
        const v = p[f] ?? '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',');
      csvLines.push(row);
    });

    // Añadir BOM para mejor compatibilidad con Excel y forzar nueva línea CRLF
    const csv = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacientes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const list = getExportList();
    if (!list || list.length === 0) {
      alert('No hay pacientes para exportar.');
      return;
    }

    // Build a reduced list with only requested fields (keys)
    const keys = exportColumns.map((c) => c.key);
    const reduced = list.map((p) => {
      const obj = {};
      keys.forEach((f) => { obj[f] = p[f] ?? ''; });
      return obj;
    });

    const dataStr = JSON.stringify(reduced, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacientes_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const enviarSMSLote = async () => {
    const confirmar = window.confirm('¿Estás seguro de enviar SMS al lote del día? Esta acción no se puede deshacer.');
    if (!confirmar) return;

    setEnviandoSMS(true);
    setMensajeSMS("");

    try {
      const resp = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacientes }),
      });

      const result = await resp.json();

      if (resp.ok) {
        setMensajeSMS(`Éxito: ${result.mensaje}`);
      } else {
        setMensajeSMS(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error enviando SMS:', err);
      setMensajeSMS('Error al enviar SMS. Revisa la consola para más detalles.');
    } finally {
      setEnviandoSMS(false);
    }
  };

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
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleFileInput(file);
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

          {/* Estado del resultado */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Estado del resultado</label>
            <select
              value={estadoResultado}
              onChange={(e) => setEstadoResultado(e.target.value)}
            >
              <option value="pendiente">Pendiente</option>
              <option value="disponible">Disponible</option>
            </select>
          </div>

          {/* PSA Total y Libre (ng/ml) */}
          <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label>PSA total (ng/ml)</label>
              <input
                type="text"
                value={psaTotal}
                onChange={(e) => setPsaTotal(e.target.value)}
                placeholder="Ej. 2.5"
              />
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label>PSA libre (ng/ml)</label>
              <input
                type="text"
                value={psaLibre}
                onChange={(e) => setPsaLibre(e.target.value)}
                placeholder="Ej. 0.8"
              />
            </div>
          </div>
          {getPSALibrePercent(psaTotal, psaLibre) != null && shouldShowPSALibreRelation(psaTotal) && (
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "-0.25rem", marginBottom: "0.5rem" }}>
              <strong>PSA libre/total:</strong> {getPSALibrePercent(psaTotal, psaLibre)}%
              {getPSALibreInterpretation(psaTotal, psaLibre)}
            </p>
          )}

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

      {/* Cuadro / modal simple con la lista filtrada */}
      {showListBox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ width: '95%', maxWidth: 760, background: 'white', color: '#020617', borderRadius: 10, padding: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Lista de pacientes</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={exportToCSV} style={{ backgroundColor: '#111827', color: 'white' }}>Exportar CSV</button>
                <button type="button" onClick={() => setShowListBox(false)} style={{ backgroundColor: '#6b7280', color: 'white' }}>Cerrar</button>
              </div>
            </div>

            <div style={{ maxHeight: '60vh', overflow: 'auto', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: '#f3f4f6' }}>
                    {exportColumns.map((c) => (
                      <th key={c.key} style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(searchTerm ? pacientesFiltrados : pacientes).map((p) => (
                    <tr key={p.id}>
                      {exportColumns.map((c) => (
                        <td key={c.key} style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{p[c.key] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

              <div className="list-actions-row">
                <input
                  type="text"
                  placeholder="Buscar por nombre o cédula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button type="button" onClick={() => setShowListBox(true)} className="btn-secondary">
                  Ver lista
                </button>
                <button type="button" onClick={exportToCSV} className="btn-secondary">
                  Exportar CSV
                </button>
                <button type="button" onClick={exportToJSON} className="btn-secondary">
                  Exportar JSON
                </button>
                <button
                  type="button"
                  onClick={enviarSMSLote}
                  disabled={enviandoSMS}
                  className="btn-sms"
                >
                  {enviandoSMS ? 'Enviando SMS...' : 'Enviar SMS'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const daysToAdd = ((8 - now.getDay()) % 7) || 7;
                    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd);
                    const pad = (n) => String(n).padStart(2, '0');
                    const dateStr = `${nextMonday.getFullYear()}-${pad(nextMonday.getMonth()+1)}-${pad(nextMonday.getDate())}`;
                    window.open(`/whatsapp-link?date=${encodeURIComponent(dateStr)}`, '_blank');
                  }}
                  className="btn-whatsapp"
                >
                  WhatsApp
                </button>
              </div>
          </div>
        </div>

        {mensajeSMS && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: mensajeSMS.startsWith('Éxito') ? '#d1fae5' : '#fee2e2', borderRadius: '0.375rem' }}>
            <p style={{ margin: 0, color: mensajeSMS.startsWith('Éxito') ? '#065f46' : '#991b1b' }}>{mensajeSMS}</p>
          </div>
        )}

        {cargandoPacientes ? (
          <p style={{ marginTop: "1rem" }}>Cargando pacientes...</p>
        ) : pacientesFiltrados.length === 0 ? (
          <p style={{ marginTop: "1rem" }}>
            {searchTerm.trim() ? `Ninguna coincidencia para "${searchTerm.trim()}".` : "No hay pacientes registrados aún."}
          </p>
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
                  <th>PSA total / libre</th>
                  <th>PSA libre %</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td>{formatoNombre(p.nombreCompleto)}</td>
                    <td>{formatoCedula(p.cedula)}</td>
                    <td>{p.localidad || "-"}</td>
                    <td>{p.edad ?? "-"}</td>
                    <td>{p.email || "-"}</td>
                    <td>{(p.psaTotal != null || p.psaLibre != null) ? `${p.psaTotal ?? "-"} / ${p.psaLibre ?? "-"}` : "-"}</td>
                    <td>{getPSALibrePercent(p.psaTotal, p.psaLibre) != null && shouldShowPSALibreRelation(p.psaTotal) ? `${getPSALibrePercent(p.psaTotal, p.psaLibre)}%` : "-"}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <div className="actions-cell">
                        <button onClick={() => irADetalle(p.id)} style={{ backgroundColor: "#2563eb" }}>Ver ficha</button>
                        <button onClick={() => empezarEdicion(p)} style={{ backgroundColor: "#10b981" }}>Editar</button>
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
