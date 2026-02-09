// src/pages/Laboratorio.jsx
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../context/AuthContext.jsx";
import { formatoNombre, formatoCedula, nombreParaBusqueda } from "../utils/formatoPaciente";

export default function Laboratorio() {
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [file, setFile] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const { user } = useAuth();

  useEffect(() => {
    const q = query(
      collection(db, "pacientes"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setPacientes(lista);
        setCargando(false);
      },
      (err) => {
        console.error("Error cargando pacientes:", err);
        setCargando(false);
      }
    );

    return () => unsub();
  }, []);

  const pacientesFiltrados = pacientes.filter((p) => {
    const t = searchTerm.trim();
    if (!t) return true;
    const nombreTexto = p.nombreCompleto ?? p.nombre ?? "";
    const nombreBusqueda = nombreParaBusqueda(nombreTexto);
    const ced = formatoCedula(p.cedula);
    const termNombre = nombreParaBusqueda(t);
    const termDigitos = formatoCedula(t);
    const coincideNombre =
      nombreBusqueda.includes(termNombre) ||
      (termNombre.length > 0 && termNombre.split(/\s+/).every((palabra) => nombreBusqueda.includes(palabra)));
    return coincideNombre || ced.includes(termDigitos);
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!user) {
      setError("Debe iniciar sesión.");
      return;
    }

    if (!selectedPaciente) {
      setError("Seleccione un paciente.");
      return;
    }

    if (!file) {
      setError("Seleccione un archivo PDF.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF.");
      return;
    }

    try {
      setSubiendo(true);

      const path = `laboratorios/${selectedPaciente.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);

      const url = await getDownloadURL(storageRef);

      // Guardamos metadata en una subcolección
      await addDoc(
        collection(db, "pacientes", selectedPaciente.id, "laboratorios"),
        {
          url,
          nombreArchivo: file.name,
          fecha: serverTimestamp(),
          medicoId: user.uid,
        }
      );

      setMensaje("PDF subido correctamente.");
      setFile(null);
    } catch (err) {
      console.error("Error subiendo PDF:", err);
      setError("No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="single-panel">
      <h1>Laboratorio</h1>
      <p>
        Busca al paciente y sube el PDF con sus resultados de laboratorio.
      </p>

      {/* Buscador y lista de pacientes */}
      <div
        style={{
          marginTop: "1rem",
          marginBottom: "1rem",
        }}
      >
        <input
          type="text"
          placeholder="Buscar por nombre o cédula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      {cargando ? (
        <p>Cargando pacientes...</p>
      ) : pacientesFiltrados.length === 0 ? (
        <p>{searchTerm.trim() ? 'Ninguna coincidencia para la búsqueda.' : 'No hay pacientes registrados.'}</p>
      ) : (
        <div
          style={{
            maxHeight: "220px",
            overflowY: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            marginBottom: "1rem",
          }}
        >
          {pacientesFiltrados.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPaciente(p)}
              style={{
                padding: "0.5rem 0.6rem",
                cursor: "pointer",
                backgroundColor:
                  selectedPaciente?.id === p.id ? "#e5f9e5" : "white",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <div>
                <strong>{formatoNombre(p.nombreCompleto)}</strong>
                <div style={{ fontSize: "0.8rem", color: "#4b5563" }}>
                  Cédula: {formatoCedula(p.cedula)}
                </div>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#4b5563" }}>
                Edad: {p.edad ?? "-"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de subida */}
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Paciente seleccionado
          </label>
          <input
            readOnly
            value={
              selectedPaciente
                ? `${formatoNombre(selectedPaciente.nombreCompleto)} (${formatoCedula(selectedPaciente.cedula)})`
                : "Ninguno"
            }
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              backgroundColor: "#f9fafb",
            }}
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Archivo PDF de laboratorio
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: "0.5rem" }}>{error}</p>
        )}
        {mensaje && (
          <p style={{ color: "green", marginBottom: "0.5rem" }}>{mensaje}</p>
        )}

        <button
          type="submit"
          disabled={subiendo}
          style={{
            padding: "0.6rem 1.2rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          {subiendo ? "Subiendo..." : "Subir PDF"}
        </button>
      </form>
    </div>
  );
}
