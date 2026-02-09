// src/pages/ImportarPSA.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { parseTxtToRows, normalizarNombre } from "../utils/pdfParser";

// Archivo .txt en public/ — coloca aquí tu base HDL convertida a texto
const TXT_URL = "/datos-psa.txt";

export default function ImportarPSA() {
  const [pdfRows, setPdfRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pacientes, setPacientes] = useState([]);
  const [asignando, setAsignando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const loadPacientes = async () => {
    try {
      const snap = await getDocs(collection(db, "pacientes"));
      setPacientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los pacientes.");
    }
  };

  useEffect(() => {
    loadPacientes();
  }, []);

  const handleTxtFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResultado(null);
    setLoading(true);
    setPdfRows([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const rows = parseTxtToRows(text);
        setPdfRows(rows);
        if (rows.length === 0) setError("No se detectaron filas con datos. Revisa el formato del archivo (cédula, nombre, PSA total, PSA libre).");
      } catch (err) {
        console.error(err);
        setError(err?.message || "Error al leer el archivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("No se pudo leer el archivo.");
      setLoading(false);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleCargarDesdeServidor = async () => {
    setError("");
    setResultado(null);
    setLoading(true);
    setPdfRows([]);
    try {
      const res = await fetch(TXT_URL);
      if (!res.ok) throw new Error("Archivo no encontrado. Coloca datos-psa.txt en la carpeta public/.");
      const text = await res.text();
      const rows = parseTxtToRows(text);
      setPdfRows(rows);
      if (rows.length === 0) setError("No se detectaron filas. Revisa el formato de datos-psa.txt.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error al cargar desde el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Asignar solo a pacientes que coincidan por nombre y/o cédula
  const coincidencia = (paciente, row) => {
    const nomPac = normalizarNombre(paciente.nombreCompleto || "");
    const nomRow = normalizarNombre(row.nombre || "");
    const cedPac = String(paciente.cedula || "").replace(/\s/g, "");
    const cedRow = String(row.cedula || "").replace(/\s/g, "");

    if (cedPac && cedRow && cedPac === cedRow) return true;
    if (nomPac && nomRow) {
      if (nomPac === nomRow) return true;
      if (nomPac.includes(nomRow) || nomRow.includes(nomPac)) return true;
    }
    return false;
  };

  const handleAsignar = async () => {
    if (pdfRows.length === 0) {
      setError("Primero carga el archivo .txt.");
      return;
    }
    setError("");
    setAsignando(true);
    setResultado({ actualizados: 0, sinMatch: 0, errores: 0 });

    try {
      let actualizados = 0;
      let sinMatch = 0;
      let errores = 0;

      for (const paciente of pacientes) {
        const row = pdfRows.find((r) => coincidencia(paciente, r));
        if (!row) {
          sinMatch++;
          continue;
        }
        if (row.psaTotal == null && row.psaLibre == null) continue;

        try {
          await updateDoc(doc(db, "pacientes", paciente.id), {
            psaTotal: row.psaTotal != null ? String(row.psaTotal) : null,
            psaLibre: row.psaLibre != null ? String(row.psaLibre) : null,
          });
          actualizados++;
        } catch (e) {
          console.error("Error actualizando", paciente.id, e);
          errores++;
        }
      }

      setResultado({ actualizados, sinMatch, errores });
      if (actualizados > 0) loadPacientes();
    } catch (err) {
      console.error(err);
      setError("Error al asignar PSA.");
    } finally {
      setAsignando(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 720, margin: "0 auto", padding: "1rem" }}>
      <h1 className="page-header-title">Importar PSA desde archivo .txt</h1>
      <p className="page-header-subtitle">
        Elige el archivo .txt de la base HDL (una línea por persona). Se asignan PSA total y PSA libre solo a los pacientes que coincidan por nombre y cédula (orden en el archivo: primero PSA total, luego PSA libre).
      </p>

      <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={handleCargarDesdeServidor}
          disabled={loading}
          style={{ padding: "0.6rem 1.2rem", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          {loading ? "Cargando..." : "Cargar desde app (public/datos-psa.txt)"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="file" accept=".txt,text/plain" onChange={handleTxtFile} disabled={loading} style={{ maxWidth: "260px" }} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>O elegir archivo</span>
        </label>
        <button
          type="button"
          onClick={handleAsignar}
          disabled={asignando || pdfRows.length === 0}
          style={{ padding: "0.6rem 1.2rem", background: "#059669", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          {asignando ? "Asignando..." : "Asignar PSA a pacientes"}
        </button>
      </div>

      {error && <p style={{ color: "#f87171", marginTop: "0.75rem" }}>{error}</p>}
      {resultado && (
        <p style={{ color: "#86efac", marginTop: "0.75rem" }}>
          Actualizados: <strong>{resultado.actualizados}</strong> · Sin coincidencia: <strong>{resultado.sinMatch}</strong>
          {resultado.errores ? ` · Errores: ${resultado.errores}` : ""}
        </p>
      )}

      {pdfRows.length > 0 && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Vista previa ({pdfRows.length} filas)</h2>
          <div className="table-wrapper table-scroll" style={{ maxHeight: "400px" }}>
            <table className="pacientes-table">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre</th>
                  <th>PSA total</th>
                  <th>PSA libre</th>
                </tr>
              </thead>
              <tbody>
                {pdfRows.slice(0, 100).map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.cedula ?? "-"}</td>
                    <td>{row.nombre || "-"}</td>
                    <td>{row.psaTotal != null ? row.psaTotal : "-"}</td>
                    <td>{row.psaLibre != null ? row.psaLibre : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pdfRows.length > 100 && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Mostrando 100 de {pdfRows.length} filas.</p>}
        </section>
      )}
    </div>
  );
}
