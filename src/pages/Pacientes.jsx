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
import { useNavigate, useSearchParams } from "react-router-dom";
import { filtroJornada } from "../utils/jornada";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPSALibrePercent, getPSALibreInterpretation, shouldShowPSALibreRelation } from "../utils/psaUtils";
import { formatoNombre, formatoCedula, nombreParaBusqueda } from "../utils/formatoPaciente";
import { cedulaVE, telefonoE164VE, correoNormalizado, fechaNacimientoISO, fechaParaFormulario, mascaraFechaRapida, edadDesdeFecha } from "../utils/registroExpress";

export default function Pacientes() {
  // Campos del formulario
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cedula, setCedula] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("V");
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
  const [permitirOcrExterno, setPermitirOcrExterno] = useState(false);
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
    let tieneCedula = Boolean(cedula), tieneNombre = Boolean(nombreCompleto);
    try {
      // Solo enviar la fotografía a proveedor externo si se marca el consentimiento.
      if (permitirOcrExterno) try {
        const serverRes = await callOcrSpaceServer(file);
        if (serverRes) {
          if (serverRes.cedula && !tieneCedula) {
            try { const d = cedulaVE(serverRes.cedula, tipoDocumento);
              setCedula(d.cedula); setTipoDocumento(d.tipoDocumento); tieneCedula = true;
            } catch { /* requiere verificación */ }
          }
          if (serverRes.nombre && !tieneNombre) {
            setNombreCompleto(formatoNombre(serverRes.nombre)); tieneNombre = true;
          }
          if (serverRes.fecha && !fechaNacimiento) {
            try { setFechaNacimiento(fechaParaFormulario(fechaNacimientoISO(serverRes.fecha))); }
            catch { /* requiere verificación */ }
          }
          if (serverRes.text) setOcrRaw(serverRes.text);
          setExtractedNotice({ source: 'OCR.space', ...serverRes });
        }
      } catch (srvErr) {
        console.warn('OCR.space call failed', srvErr);
      }

      // si no se detectó cédula o nombre, intentar local
      if (!tieneCedula || !tieneNombre) {
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
            if (best.cedula && !tieneCedula) {
              try { const d = cedulaVE(best.cedula, tipoDocumento);
                setCedula(d.cedula); setTipoDocumento(d.tipoDocumento); tieneCedula = true;
              } catch { /* requiere verificación */ }
            }
            if (best.nombre && !tieneNombre) {
              setNombreCompleto(formatoNombre(best.nombre)); tieneNombre = true;
            }
            if (best.fecha && !fechaNacimiento) {
              try { setFechaNacimiento(fechaParaFormulario(fechaNacimientoISO(best.fecha))); }
              catch { /* requiere verificación */ }
            }
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
  const [searchParams, setSearchParams] = useSearchParams();
  const periodo = searchParams.get("periodo") || "2026";

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
    setTipoDocumento("V");
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

      const documento = cedulaVE(cedula, tipoDocumento);
      const nacimiento = fechaNacimientoISO(fechaNacimiento);
      const edadManual = edad.trim() === "" ? null : Number.parseInt(edad.trim(), 10);
      const edadCalculada = edadDesdeFecha(nacimiento);
      // Comprobación previa con la lista cargada. Para prevenir carreras entre operadores,
      // la protección definitiva debe usar una transacción con índice único de cédula.
      if (pacientes.some((p) => p.id !== editingId && formatoCedula(p.cedula) === documento.cedula)) {
        throw new Error("Paciente con esta cédula ya registrado. Verifica antes de continuar.");
      }

      const dataPaciente = {
        nombreCompleto: formatoNombre(nombreCompleto),
        cedula: documento.cedula,
        tipoDocumento: documento.tipoDocumento,
        telefono: telefonoE164VE(telefono),
        localidad: localidad.trim(),
        edad: edadCalculada ?? (Number.isNaN(edadManual) ? null : edadManual),
        fechaNacimiento: nacimiento,
        email: correoNormalizado(email),
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
      setError(/^(La cédula|Selecciona|El teléfono|Introduce|El correo|Escribe|La fecha|Paciente con)/.test(err?.message || "")
        ? err.message : "No se pudo guardar el paciente.");
    } finally {
      setSubmitting(false);
    }
  };

  const irADetalle = (idPaciente) => {
    navigate(`/pacientes/${idPaciente}`);
  };

  const empezarEdicion = (paciente) => {
    setNombreCompleto(paciente.nombreCompleto || "");
    setCedula(formatoCedula(paciente.cedula || ""));
    setTipoDocumento(paciente.tipoDocumento || (/^E/i.test(String(paciente.cedula || "")) ? "E" : "V"));
    setTelefono(paciente.telefono || "");
    setLocalidad(paciente.localidad || "");
    setEdad(paciente.edad != null ? String(paciente.edad) : "");
    setFechaNacimiento(fechaParaFormulario(paciente.fechaNacimiento || ""));
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
    if (!filtroJornada(p, periodo)) return false;
    const termino = searchTerm.trim();
    if (!termino) return true;

    const nombreTexto = p.nombreCompleto ?? p.nombre ?? "";
    const nombreBusqueda = nombreParaBusqueda(nombreTexto);
    const ced = formatoCedula(p.cedula);
    const terminoNombre = nombreParaBusqueda(termino);
    const terminoDigitos = formatoCedula(termino);

    const coincideNombre =
      nombreBusqueda.includes(terminoNombre) ||
      (terminoNombre.length > 0 && terminoNombre.split(/\s+/).every((palabra) => nombreBusqueda.includes(palabra)));
    const coincideCedula = terminoDigitos.length > 0 && ced.includes(terminoDigitos);
    return coincideNombre || coincideCedula;
  });

  // Exportar pacientes simplificado: solo campos del registro (nombre + datos de registro)
  const getExportList = () => pacientesFiltrados;

  // Columnas a mostrar/exportar: clave y etiqueta en español
  const exportColumns = [
    { key: 'nombreCompleto', label: 'Nombre' },
    { key: 'cedula', label: 'Cédula' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Correo electrónico' },
    { key: 'localidad', label: 'Localidad' },
    { key: 'edad', label: 'Edad' },
    { key: 'fechaNacimiento', label: 'Fecha de nacimiento' },
    { key: 'estadoResultado', label: 'Estado del resultado' },
    { key: 'notas', label: 'Notas' },
    { key: 'psaTotal', label: 'PSA total (ng/ml)' },
    { key: 'psaLibre', label: 'PSA libre (ng/ml)' },
    { key: 'psaRelacion', label: 'Relación PSA libre/total (%)' },
    { key: 'createdAt', label: 'Fecha de registro' },
  ];

  const getValue = (p, key) => {
    if (key === 'nombreCompleto') {
      return p.nombreCompleto ?? p.nombre ?? '';
    }

    if (key === 'psaRelacion') {
      const percent = getPSALibrePercent(p.psaTotal, p.psaLibre);
      return percent != null ? `${percent}%` : '';
    }

    if (key === 'createdAt') {
      const createdAt = p.createdAt;
      if (!createdAt) return '';
      if (typeof createdAt.toDate === 'function') {
        return createdAt.toDate().toLocaleString();
      }
      return String(createdAt);
    }

    let value = '';
    if (key.includes('.')) {
      const [obj, prop] = key.split('.');
      value = p[obj]?.[prop] ?? '';
    } else {
      value = p[key] ?? '';
    }

    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    return value;
  };

  const [showListBox, setShowListBox] = useState(false);

  const exportToExcel = () => {
    const list = getExportList();
    if (!list || list.length === 0) {
      alert('No hay pacientes para exportar.');
      return;
    }

    const data = [exportColumns.map((c) => c.label)];
    list.forEach((p) => {
      const row = exportColumns.map((col) => getValue(p, col.key));
      data.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = exportColumns.map((col) => ({ wch: Math.max(16, col.label.length + 4) }));

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        const cell = ws[cellRef];
        if (!cell) continue;

        const style = {
          font: { name: 'Arial', sz: 11 },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          },
        };

        if (R === 0) {
          style.font.bold = true;
          style.fill = { fgColor: { rgb: 'FFDCE6F1' } };
        } else if (R % 2 === 1) {
          style.fill = { fgColor: { rgb: 'FFF7FAFC' } };
        }

        cell.s = style;
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
    XLSX.writeFile(wb, `pacientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = () => {
    const list = getExportList();
    if (!list || list.length === 0) {
      alert('No hay pacientes para exportar.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const title = 'Listado de pacientes';
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    const head = [exportColumns.map((c) => c.label)];
    const body = list.map((p) => exportColumns.map((col) => String(getValue(p, col.key) ?? '')));

    autoTable(doc, {
      startY: 60,
      head,
      body,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [22, 54, 92], textColor: 255, halign: 'center' },
      alternateRowStyles: { fillColor: [244, 246, 248] },
      margin: { left: 20, right: 20 },
      tableLineWidth: 0.3,
      tableLineColor: [200, 200, 200],
    });

    doc.save(`pacientes_${new Date().toISOString().slice(0, 10)}.pdf`);
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
      keys.forEach((f) => { obj[f] = getValue(p, f); });
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
      <header className="zori-pacientes-intro">
        <div>
          <h1>Buscar pacientes</h1>
          <p>Consulta y corrige expedientes. El escaneo de cédulas y el nuevo ingreso se hacen únicamente desde Registrar.</p>
        </div>
        <button type="button" onClick={() => navigate("/registro")}>+ Registrar nuevo paciente</button>
      </header>
      {/* Solo se muestra este formulario al seleccionar Editar en un registro existente. */}
      {editingId && (
      <section className="form-card">
        <h2 className="page-header-title">Editar datos del paciente</h2>
        <p className="page-header-subtitle">Modifica únicamente la ficha seleccionada.</p>

        <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
          {/* Nombre */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Nombre completo *</label>
            <input
              type="text"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(formatoNombre(e.target.value))}
              required
            />
          </div>

          {/* Nacionalidad y documento: conservar cédula numérica para expedientes antiguos. */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Cédula / Documento *</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} aria-label="Tipo de documento" style={{ maxWidth: "9rem" }}>
                <option value="V">V - Venezolano</option>
                <option value="E">E - Extranjero</option>
              </select>
              <input type="text" inputMode="numeric" placeholder="Número" maxLength={9} required
                value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 9))}
                style={{ flex: 1, minWidth: 0 }} />
            </div>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label>Teléfono móvil venezolano</label>
            <input type="tel" inputMode="tel" autoComplete="tel" value={telefono}
              placeholder="0412-123.45.67 o +58 412 1234567"
              onChange={(e) => setTelefono(e.target.value)}
              onBlur={() => { try { if (telefono.trim()) setTelefono(telefonoE164VE(telefono)); } catch { /* corregir al guardar */ } }} />
            <small>Se guarda con +58 para facilitar mensajes y llamadas.</small>
          </div>

          {/* Email */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail(email.trim().toLowerCase())}
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
          <div style={{ marginBottom: "0.75rem" }}>
            <label>Fecha de nacimiento (DD/MM/AAAA)</label>
            <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10}
              value={fechaNacimiento} onChange={(e) => {
                const valor = mascaraFechaRapida(e.target.value);
                setFechaNacimiento(valor);
                if (valor.length === 10) {
                  try { setEdad(String(edadDesdeFecha(fechaNacimientoISO(valor)))); } catch { /* esperar corrección */ }
                }
              }} />
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
      )}

      {/* Cuadro / modal simple con la lista filtrada */}
      {showListBox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ width: '95%', maxWidth: 760, background: 'white', color: '#020617', borderRadius: 10, padding: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Lista de pacientes</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  {pacientesFiltrados.map((p) => (
                    <tr key={p.id}>
                      {exportColumns.map((c) => (
                        <td key={c.key} style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{getValue(p, c.key)}</td>
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
        <div className="zori-period-tabs" aria-label="Seleccionar jornada">
          {[
            ["2026", "Jornada 2026"],
            ["2025", "Histórico 2025"],
            ["sin-fecha", "Sin clasificar"],
            ["todos", "Todas"]
          ].map(([valor, titulo]) => (
            <button key={valor} type="button"
              className={periodo === valor ? "is-active" : ""}
              aria-pressed={periodo === valor}
              onClick={() => setSearchParams({periodo: valor})}>{titulo}</button>
          ))}
        </div>
        <div className="list-header">
          <div className="list-header-top">
            <div>
              <h2 className="list-title">Lista de pacientes</h2>
              {!cargandoPacientes && (
                <p className="page-header-subtitle" style={{ marginTop: "6px" }}>
                  Registros de {periodo === "sin-fecha" ? "fecha desconocida" : periodo === "todos" ? "todos los años" : periodo}: <strong>{pacientesFiltrados.length}</strong>
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
          <div className="table-wrapper table-scroll table-wrapper--scroll-y" style={{ marginTop: "0.6rem" }}>
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


    </div>
  );
}
