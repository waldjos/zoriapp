// src/pages/Pacientes.jsx
import { useEffect, useState } from "react";
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
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");

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
    <div className="pacientes-layout">
      {/* FORMULARIO DE REGISTRO / EDICIÓN */}
      <section>
        <h1>Pacientes</h1>
        <p>Registra y administra los pacientes de la jornada.</p>

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

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
              }}
            >
              {submitting
                ? editingId
                  ? "Guardando cambios..."
                  : "Guardando..."
                : editingId
                ? "Actualizar paciente"
                : "Registrar paciente"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelarEdicion}
                style={{
                  padding: "0.6rem 1.2rem",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>

      {/* LISTADO DE PACIENTES */}
      <section className="pacientes-list-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>Lista de pacientes</h2>

          <input
            type="text"
            placeholder="Buscar por nombre o cédula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: "200px",
              maxWidth: "320px",
              padding: "0.4rem 0.6rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        {/* 🔢 CONTADOR DE PACIENTES */}
        {!cargandoPacientes && (
          <p
            style={{
              marginTop: "0.6rem",
              marginBottom: "0.2rem",
              color: "#4b5563",
              fontSize: "0.9rem",
            }}
          >
            Total de pacientes registrados:{" "}
            <strong>{pacientes.length}</strong>
            {searchTerm && (
              <>
                {" "}
                | Coincidencias en la búsqueda:{" "}
                <strong>{pacientesFiltrados.length}</strong>
              </>
            )}
          </p>
        )}

        {cargandoPacientes ? (
          <p style={{ marginTop: "1rem" }}>Cargando pacientes...</p>
        ) : pacientesFiltrados.length === 0 ? (
          <p style={{ marginTop: "1rem" }}>No hay pacientes registrados aún.</p>
        ) : (
          <div className="pacientes-table-wrapper">
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "1rem",
                fontSize: "0.95rem",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Nombre
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Cédula
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Localidad
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Edad
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Correo
                  </th>
                  <th
                    style={{
                      padding: "0.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td
                      style={{
                        padding: "0.5rem",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {p.nombreCompleto}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {p.cedula}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {p.localidad || "-"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {p.edad ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {p.email || "-"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        borderBottom: "1px solid #f3f4f6",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <button
                        onClick={() => irADetalle(p.id)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          marginRight: "0.3rem",
                          backgroundColor: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Ver ficha
                      </button>
                      <button
                        onClick={() => empezarEdicion(p)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          marginRight: "0.3rem",
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarPaciente(p.id)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* ...después de la tabla de pacientes */}
<ProsilodBanner />
    </div>
  );
}
