// src/pages/RegistroPaciente.jsx
import { useRef, useState } from "react";
import { guardarPacienteLocal } from "../utils/colaPacientesOffline";
import { formatoNombre } from "../utils/formatoPaciente";
import { useAuth } from "../context/AuthContext.jsx";
import CedulaOCR from "../components/CedulaOCR";
import { cedulaVE, telefonoE164VE, correoNormalizado, fechaNacimientoISO, fechaParaFormulario, mascaraFechaRapida, edadDesdeFecha } from "../utils/registroExpress";

export default function RegistroPaciente() {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cedula, setCedula] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("V");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [edad, setEdad] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [verificado, setVerificado] = useState(false);
  const ultimoOCR = useRef({ nombre: "", cedula: "", fecha: "" });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { user } = useAuth();

  const recibirLecturaOCR = ({ cedula: numero, tipo, nombre, fecha }) => {
    setVerificado(false);
    const anterior = ultimoOCR.current;

    // Nunca conservar automáticamente información de una lectura anterior
    // si el nuevo documento no produjo un resultado válido para ese campo.
    if (anterior.nombre && nombreCompleto === anterior.nombre) setNombreCompleto("");
    if (anterior.cedula && cedula === anterior.cedula) setCedula("");
    if (anterior.fecha && fechaNacimiento === anterior.fecha) {
      setFechaNacimiento("");
      setEdad("");
    }
    ultimoOCR.current = { nombre: "", cedula: "", fecha: "" };

    if (numero) {
      try {
        const d = cedulaVE(numero, tipo || tipoDocumento);
        setCedula(d.cedula);
        ultimoOCR.current.cedula = d.cedula;
        if (d.tipoDocumento) setTipoDocumento(d.tipoDocumento);
      } catch { /* El registrador completa la cédula manualmente. */ }
    }
    if (nombre) {
      const normalizado = formatoNombre(nombre);
      setNombreCompleto(normalizado);
      ultimoOCR.current.nombre = normalizado;
    }
    if (fecha) {
      try {
        const iso = fechaNacimientoISO(fecha);
        const enPantalla = fechaParaFormulario(iso);
        setFechaNacimiento(enPantalla);
        setEdad(String(edadDesdeFecha(iso)));
        ultimoOCR.current.fecha = enPantalla;
      } catch { /* Fecha ilegible: revisión manual obligatoria. */ }
    }
  };

  const limpiarFormulario = () => {
    setNombreCompleto("");
    setCedula("");
    setTipoDocumento("V");
    setFechaNacimiento("");
    setTelefono("");
    setLocalidad("");
    setEdad("");
    setEmail("");
    setNotas("");
    setVerificado(false);
    ultimoOCR.current = { nombre: "", cedula: "", fecha: "" };
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

      if (!verificado) {
        throw new Error("Confirma que verificaste los datos con la cédula antes de guardar.");
      }

      const documento = cedulaVE(cedula, tipoDocumento);
      const telefonoNormalizado = telefonoE164VE(telefono);
      const emailNormalizado = correoNormalizado(email);
      const nacimiento = fechaNacimientoISO(fechaNacimiento);
      const edadManual = edad.trim() === "" ? null : Number.parseInt(edad.trim(), 10);
      // Nunca bloquear el registro por falta de conectividad.
      // La cola cifrada conserva cada ficha hasta confirmar su subida a Firebase.
      const datos = {
        jornadaAnio: 2026,
        jornadaId: "domingo-luciani-2026",
        nombreCompleto: formatoNombre(nombreCompleto),
        cedula: documento.cedula,
        tipoDocumento: documento.tipoDocumento,
        telefono: telefonoNormalizado,
        localidad: localidad.trim(),
        edad: edadDesdeFecha(nacimiento) ?? (Number.isNaN(edadManual) ? null : edadManual),
        fechaNacimiento: nacimiento,
        email: emailNormalizado,
        notas: notas.trim(),
      };

      await guardarPacienteLocal(datos, user.uid);

      setSuccess("Ficha guardada en este dispositivo. Se sincronizará con Firebase al recuperar internet; revisa el contador de pendientes.");
      limpiarFormulario();
    } catch (err) {
      console.error("Error guardando paciente:", err);
      setError(/^(La cédula|Selecciona|El teléfono|Introduce|El correo|Escribe|La fecha|Paciente con|Este navegador|Debes iniciar|No se pudo abrir|Cierra las otras|Confirma que)/.test(err?.message || "")
        ? err.message : "No se pudo guardar en el dispositivo. No cierres esta pantalla; copia los datos antes de reintentar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="single-panel zori-registro">
      <h1>Registro de paciente</h1>
      <p>Completa los datos para registrar un nuevo paciente en la jornada.</p>
      <p className="zori-offline-hint">Funciona sin internet tras preparar la app con conexión. Cada ficha queda cifrada en este teléfono hasta que Firebase confirme la sincronización.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
        <CedulaOCR onExtract={recibirLecturaOCR} />
        <p className="zori-registro-step">2. Confirmar datos del paciente</p>
        {/* Nombre */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Nombre completo *
          </label>
          <input
            type="text"
            value={nombreCompleto}
            onChange={(e) => {
              setNombreCompleto(formatoNombre(e.target.value));
              ultimoOCR.current.nombre = "";
              setVerificado(false);
            }}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div className="zori-document-field">
          <label htmlFor="zori-cedula-numero" className="zori-field-label">Cédula / Documento *</label>
          <div className="zori-document-row">
            <div className="zori-document-prefix">
              <label htmlFor="zori-cedula-tipo">Tipo</label>
              <select id="zori-cedula-tipo" value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}>
                <option value="V">V</option>
                <option value="E">E</option>
              </select>
            </div>
            <div className="zori-document-number">
              <label htmlFor="zori-cedula-numero">Número</label>
              <input id="zori-cedula-numero" type="text" inputMode="numeric"
                maxLength={9} placeholder="12345678" required
                value={cedula}
                onChange={(e) => {
                  setCedula(e.target.value.replace(/\D/g, "").slice(0, 9));
                  ultimoOCR.current.cedula = "";
                  setVerificado(false);
                }} />
            </div>
          </div>
          <small>V: venezolano · E: extranjero</small>
        </div>

        {/* Teléfono */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Teléfono
          </label>
          <input type="tel" inputMode="tel" value={telefono} placeholder="0412-123.45.67"
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={() => { try { if (telefono.trim()) setTelefono(telefonoE164VE(telefono)); } catch { /* corregir al guardar */ } }}
            style={{ width: "100%", padding: "0.5rem" }} />
          <small>Automáticamente se guarda con +58 para mensajería.</small>
        </div>

        {/* Email */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmail(email.trim().toLowerCase())}
            placeholder="paciente@correo.com"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        {/* Localidad */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Localidad
          </label>
          <input
            type="text"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            placeholder="Ciudad / Hospital / Estado"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>Fecha de nacimiento (DD/MM/AAAA)</label>
          <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10}
            value={fechaNacimiento}
            onChange={(e) => {
              const valor = mascaraFechaRapida(e.target.value);
              setFechaNacimiento(valor);
              ultimoOCR.current.fecha = "";
              setVerificado(false);
              if (valor.length === 10) {
                try { setEdad(String(edadDesdeFecha(fechaNacimientoISO(valor)))); } catch { /* esperar corrección */ }
              }
            }} style={{ width: "100%", padding: "0.5rem" }} />
        </div>

        {/* Edad */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Edad
          </label>
          <input
            type="number"
            min="0"
            max="120"
            value={edad}
            onChange={(e) => setEdad(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        {/* Notas */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Notas (motivo, hallazgos, etc.)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "0.5rem", resize: "vertical" }}
          />
        </div>

        <label className="zori-confirmacion-cedula">
          <input type="checkbox" checked={verificado}
            onChange={(e) => setVerificado(e.target.checked)} required />
          <span>
            <strong>He revisado los datos de la cédula.</strong>
            <small>Comprueba especialmente los nombres, apellidos, número y fecha de nacimiento antes de guardar.</small>
          </span>
        </label>

        {error && (
          <p style={{ color: "red", marginBottom: "0.5rem" }}>{error}</p>
        )}
        {success && (
          <p style={{ color: "green", marginBottom: "0.5rem" }}>{success}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.6rem 1.2rem",
            backgroundColor: "#5CC52E",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          {submitting ? "Guardando en el teléfono…" : "Guardar ficha del paciente"}
        </button>
      </form>
    </div>
  );
}
