// src/pages/RegistroPaciente.jsx
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { formatoNombre, formatoCedula } from "../utils/formatoPaciente";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegistroPaciente() {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [edad, setEdad] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { user } = useAuth();

  const limpiarFormulario = () => {
    setNombreCompleto("");
    setCedula("");
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

      if (email.trim() && !email.includes("@")) {
        setError("El correo electrónico no es válido.");
        setSubmitting(false);
        return;
      }

      const edadNumero =
        edad.trim() === "" ? null : Number.parseInt(edad.trim(), 10);

      await addDoc(collection(db, "pacientes"), {
        nombreCompleto: formatoNombre(nombreCompleto),
        cedula: formatoCedula(cedula),
        telefono: telefono.trim(),
        localidad: localidad.trim(),
        edad: isNaN(edadNumero) ? null : edadNumero,
        email: email.trim(),
        notas: notas.trim(),
        createdAt: serverTimestamp(),
        creadoPor: user.uid,
      });

      setSuccess("Paciente registrado correctamente.");
      limpiarFormulario();
    } catch (err) {
      console.error("Error guardando paciente:", err);
      setError("No se pudo registrar el paciente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="single-panel">
      <h1>Registro de paciente</h1>
      <p>Completa los datos para registrar un nuevo paciente en la jornada.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
        {/* Nombre */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Nombre completo *
          </label>
          <input
            type="text"
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        {/* Cédula */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Cédula / Documento *
          </label>
          <input
            type="text"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        {/* Teléfono */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Teléfono
          </label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
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
