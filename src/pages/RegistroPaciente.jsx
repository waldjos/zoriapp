// src/pages/RegistroPaciente.jsx
import { useState } from "react";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { formatoNombre } from "../utils/formatoPaciente";
import { useAuth } from "../context/AuthContext.jsx";
import CedulaOCR from "../components/CedulaOCR";
import { cedulaVE, telefonoE164VE, correoNormalizado, fechaNacimientoISO, mascaraFechaRapida, edadDesdeFecha } from "../utils/registroExpress";

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { user } = useAuth();

  const recibirLecturaOCR = ({ cedula: numero, tipo, nombre, fecha }) => {
    if (numero) {
      try {
        const d = cedulaVE(numero, tipo || tipoDocumento);
        setCedula(d.cedula);
        if (d.tipoDocumento) setTipoDocumento(d.tipoDocumento);
      } catch { /* El registrador completa la cédula manualmente. */ }
    }
    if (nombre) setNombreCompleto(formatoNombre(nombre));
    if (fecha) {
      try {
        const iso = fechaNacimientoISO(fecha);
        setFechaNacimiento(fechaParaFormulario(iso));
        setEdad(String(edadDesdeFecha(iso)));
      } catch { /* Se requiere verificación de fecha. */ }
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
      const telefonoNormalizado = telefonoE164VE(telefono);
      const emailNormalizado = correoNormalizado(email);
      const nacimiento = fechaNacimientoISO(fechaNacimiento);
      const edadManual = edad.trim() === "" ? null : Number.parseInt(edad.trim(), 10);
      // Validación previa para evitar la mayoría de los duplicados; la protección atómica
      // se incorporará al backend antes de habilitar registros simultáneos.
      const existentes = await getDocs(query(collection(db, "pacientes"), where("cedula", "==", documento.cedula)));
      if (!existentes.empty) throw new Error("Paciente con esta cédula ya registrado. Verifica antes de continuar.");

      await addDoc(collection(db, "pacientes"), {
        nombreCompleto: formatoNombre(nombreCompleto),
        cedula: documento.cedula,
        tipoDocumento: documento.tipoDocumento,
        telefono: telefonoNormalizado,
        localidad: localidad.trim(),
        edad: edadDesdeFecha(nacimiento) ?? (Number.isNaN(edadManual) ? null : edadManual),
        fechaNacimiento: nacimiento,
        email: emailNormalizado,
        notas: notas.trim(),
        createdAt: serverTimestamp(),
        creadoPor: user.uid,
      });

      setSuccess("Paciente registrado correctamente.");
      limpiarFormulario();
    } catch (err) {
      console.error("Error guardando paciente:", err);
      setError(/^(La cédula|Selecciona|El teléfono|Introduce|El correo|Escribe|La fecha|Paciente con)/.test(err?.message || "")
        ? err.message : "No se pudo registrar el paciente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="single-panel">
      <h1>Registro de paciente</h1>
      <p>Completa los datos para registrar un nuevo paciente en la jornada.</p>

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
            onChange={(e) => setNombreCompleto(formatoNombre(e.target.value))}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>Cédula / Documento *</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} aria-label="Tipo de documento">
              <option value="V">V - Venezolano</option>
              <option value="E">E - Extranjero</option>
            </select>
            <input type="text" inputMode="numeric" maxLength={9} placeholder="Número de cédula" required
              value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 9))}
              style={{ flex: 1, minWidth: 0, padding: "0.5rem" }} />
          </div>
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
          {submitting ? "Guardando..." : "Registrar paciente"}
        </button>
      </form>
    </div>
  );
}
