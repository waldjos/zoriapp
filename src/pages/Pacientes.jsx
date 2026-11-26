// src/pages/Pacientes.jsx
import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
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
import { formatoNombre, formatoNombreEnEdicion, formatoCedula, nombreParaBusqueda } from "../utils/formatoPaciente";
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

  const { user, sede } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const solicitado = searchParams.get("periodo") || "2026";
  const periodo = sede.id === "domingo_luciani" ? solicitado : "2026";

  // Escuchar en tiempo real la colección "pacientes"
  useEffect(() => {
    // No ordenar por createdAt en la consulta: Firestore excluye registros
    // históricos que carecen de ese campo. Se ordenan después de leerlos.
    const q = query(collection(db, "sedes", sede.id, "pacientes"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Expedientes sin fecha quedan al final, pero siguen visibles
        // en las pestañas "Sin clasificar" y "Todas".
        const valorFecha = (paciente) => {
          const fecha = paciente.createdAt || paciente.fechaCapturaLocal || paciente.fechaRegistro;
          if (!fecha) return 0;
          if (typeof fecha.toMillis === "function") return fecha.toMillis();
          if (typeof fecha.seconds === "number") return fecha.seconds * 1000;
          const parsed = Date.parse(fecha);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        lista.sort((a, b) => valorFecha(b) - valorFecha(a));
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
        const ref = doc(db, "sedes", sede.id, "pacientes", editingId);
        await updateDoc(ref, {
          ...dataPaciente,
          updatedAt: serverTimestamp(),
        });
        setSuccess("Paciente actualizado correctamente.");
      } else {
        // ➕ Crear nuevo paciente
        await addDoc(collection(db, "sedes", sede.id, "pacientes"), {
          ...dataPaciente,
          jornadaId: sede.jornadaId, jornadaAnio: sede.jornadaAnio,
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

  // El total del periodo no debe depender de lo escrito en el buscador.
  const pacientesEnPeriodo = pacientes.filter((p) => filtroJornada(p, periodo));
  // Filtrado por búsqueda (nombre o cédula) — sin acentos.
  const pacientesFiltrados = pacientesEnPeriodo.filter((p) => {
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
      const resp = await Promise.reject(new Error("El envío masivo está deshabilitado en la prueba multisede.")); /*
      const respLegacy = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacientes }),
      }); */

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
              onChange={(e) => setNombreCompleto(formatoNombreEnEdicion(e.target.value))}
              onBlur={() => setNombreCompleto((anterior) => formatoNombre(anterior))}
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
          ].filter(([valor]) => sede.id === "domingo_luciani" || valor === "2026").map(([valor, titulo]) => (
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
                  Registros de {periodo === "sin-fecha" ? "fecha desconocida" : periodo === "todos" ? "todos los años" : periodo}: <strong>{pacientesEnPeriodo.length}</strong>
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
            {searchTerm.trim() ? `Ninguna coincidencia para "${searchTerm.trim()}".` : "No hay pacientes en el periodo seleccionado."}
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
                    <td>{p.estadoResultado || p.entregaResultados || "Sin estado"}</td>
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
