// src/pages/LabForm.jsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import ProsilodBanner from "../components/ProsilodBanner";
import { formatoNombre, formatoCedula, normalizarParaBusqueda } from "../utils/formatoPaciente";

export default function LabForm() {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [file, setFile] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [mensaje, setMensaje] = useState("");

  // Cargar lista de pacientes
  useEffect(() => {
    const cargarPacientes = async () => {
      try {
        const q = query(collection(db, "pacientes"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPacientes(lista);
      } catch (error) {
        console.error("Error cargando pacientes:", error);
        setMensaje("No se pudieron cargar los pacientes.");
      }
    };

    cargarPacientes();
  }, []);

  const pacientesFiltrados = pacientes.filter((p) => {
    const term = busqueda.trim();
    if (!term) return true;
    const nombreTexto = p.nombreCompleto ?? p.nombre ?? "";
    const nombreBusqueda = normalizarParaBusqueda(nombreTexto);
    const cedula = formatoCedula(p.cedula);
    const termNombre = normalizarParaBusqueda(term);
    const termDigitos = formatoCedula(term);
    const coincideNombre =
      nombreBusqueda.includes(termNombre) ||
      (termNombre.length > 0 && termNombre.split(/\s+/).every((palabra) => nombreBusqueda.includes(palabra)));
    return coincideNombre || cedula.includes(termDigitos);
  });

  const handleSeleccionPaciente = (paciente) => {
    setPacienteSeleccionado(paciente);
    setMensaje("");
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
    setMensaje("");
    setProgreso(0);
  };

  const handleUpload = () => {
    if (!pacienteSeleccionado) {
      setMensaje("Selecciona primero un paciente.");
      return;
    }
    if (!file) {
      setMensaje("Selecciona un archivo PDF de laboratorio.");
      return;
    }

    // Solo permitir PDF
    if (file.type !== "application/pdf") {
      setMensaje("El archivo debe ser un PDF.");
      return;
    }

    setSubiendo(true);
    setMensaje("Iniciando subida...");

    // Ruta en el bucket: /laboratorios/{idPaciente}/{timestamp}-{nombreArchivo}
    const filePath = `laboratorios/${pacienteSeleccionado.id}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const porcentaje =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgreso(Math.round(porcentaje));
      },
      (error) => {
        console.error("Error subiendo PDF:", error);
        setMensaje("Error al subir el PDF.");
        setSubiendo(false);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);

          // Guardamos la URL en el documento del paciente
          const pacienteRef = doc(db, "pacientes", pacienteSeleccionado.id);
          await updateDoc(pacienteRef, {
            laboratorioPdfUrl: url,
            laboratorioPdfPath: filePath,
          });

          setMensaje("PDF subido y asociado al paciente correctamente.");
          setSubiendo(false);
          setProgreso(100);

          // Actualizar pacienteSeleccionado en memoria
          setPacienteSeleccionado((prev) =>
            prev ? { ...prev, laboratorioPdfUrl: url } : prev
          );
        } catch (error) {
          console.error("Error guardando URL en Firestore:", error);
          setMensaje("El archivo se subió, pero no se pudo guardar en la ficha.");
          setSubiendo(false);
        }
      }
    );
  };

  return (
    <div className="page-wrapper">
      <div className="panel-card">
        <h1 className="page-title">Laboratorio</h1>
        <p className="page-subtitle">
          Asocia resultados de laboratorio en PDF a cada paciente.
        </p>

        {/* 1. Buscar paciente */}
        <section className="section-block">
          <h2 className="section-title">1. Buscar paciente</h2>
          <p className="section-description">
            Escribe nombre o cédula y selecciona el paciente al que
            corresponden los resultados.
          </p>

          <input
            type="text"
            className="input"
            placeholder="Buscar por nombre o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cédula</th>
                  <th>Localidad</th>
                  <th>Edad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="5" className="table-empty">
                      No se encontraron pacientes.
                    </td>
                  </tr>
                )}
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td>{formatoNombre(p.nombreCompleto)}</td>
                    <td>{formatoCedula(p.cedula)}</td>
                    <td>{p.localidad}</td>
                    <td>{p.edad}</td>
                    <td>
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => handleSeleccionPaciente(p)}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pacienteSeleccionado && (
            <p className="selected-patient">
              Paciente seleccionado:{" "}
              <strong>{formatoNombre(pacienteSeleccionado.nombreCompleto)}</strong> —{" "}
              {formatoCedula(pacienteSeleccionado.cedula)}
            </p>
          )}
        </section>

        {/* 2. Subir PDF */}
        <section className="section-block">
          <h2 className="section-title">2. Subir PDF de laboratorio</h2>
          <p className="section-description">
            Selecciona el archivo PDF que contiene los resultados.
          </p>

          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="input-file"
          />

          <div className="upload-progress">
            <div className="upload-progress-bar">
              <div
                className="upload-progress-fill"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <span className="upload-progress-text">{progreso}%</span>
          </div>

          <button
            className="btn-primary"
            disabled={subiendo}
            onClick={handleUpload}
          >
            {subiendo ? "Subiendo..." : "Subir PDF"}
          </button>

          {mensaje && <p className="status-message">{mensaje}</p>}

          {pacienteSeleccionado?.laboratorioPdfUrl && (
            <p className="status-message success">
              Este paciente ya tiene un PDF cargado.{" "}
              <a
                href={pacienteSeleccionado.laboratorioPdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver PDF
              </a>
            </p>
          )}
        </section>

        <ProsilodBanner />
      </div>
    </div>
  );
}
