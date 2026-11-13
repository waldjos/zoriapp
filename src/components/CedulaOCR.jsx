import { useRef, useState } from "react";
import { createWorker } from "tesseract.js";

/**
 * Escaneo OCR local: la foto no se envía a servicios externos ni se almacena.
 * El registrador debe confirmar los campos antes de guardarlos en Firestore.
 */
function extraerCedula(texto) {
  const limpio = String(texto || "").replace(/\r/g, "");
  const lineas = limpio.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const lineaCedula = lineas.find((l) => /(?:c[eé]dula|identidad|\b[VE][\s.\-]*\d{6,9})/i.test(l));
  const tipoExplicito = (lineaCedula || "").match(/\b([VE])\s*[-.:]?\s*(\d[\d.\s-]{5,14})/i);
  const documento = tipoExplicito || (lineaCedula || limpio).match(/\b([VE])?\s*[-.:]?\s*(\d{6,9})\b/i);
  const tipo = documento?.[1]?.toUpperCase() || null;
  const cedula = documento?.[2]?.replace(/\D/g, "").slice(0, 9) || "";

  const lineasUtiles = lineas.filter((l) =>
    !/rep[uú]blica|venezuela|bolivariana|identidad|c[eé]dula|nacionalidad|fecha|nacimiento|sexo|firma|expedici[oó]n|vencimiento|\d{4}/i.test(l));
  const nombre = lineasUtiles.map((l) => l.replace(/[^\p{L}\s'’-]/gu, " ").replace(/\s+/g, " ").trim())
    .find((l) => l.split(" ").length >= 2 && l.length >= 7) || "";
  const fecha = limpio.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/)?.[0] || "";
  return { tipo, cedula, nombre, fecha };
}

export default function CedulaOCR({ onExtract }) {
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const activo = useRef(true);

  const procesar = async (archivo) => {
    if (!archivo || leyendo) return;
    if (!archivo.type.startsWith("image/")) {
      setMensaje("Selecciona una fotografía del documento.");
      return;
    }
    setLeyendo(true);
    setMensaje("Reconociendo el documento en este dispositivo…");
    let worker;
    try {
      worker = createWorker();
      await worker.load();
      await worker.loadLanguage("spa");
      await worker.initialize("spa");
      const { data } = await worker.recognize(archivo);
      const extraido = extraerCedula(data?.text || "");
      if (activo.current) {
        onExtract(extraido);
        setMensaje(extraido.cedula || extraido.nombre
          ? "Revisa la cédula, el nombre y la fecha antes de guardar."
          : "No se pudieron reconocer los datos. Puedes escribirlos manualmente o tomar otra foto.");
      }
    } catch (error) {
      console.error("Error de OCR local:", error);
      if (activo.current) setMensaje("No se pudo leer la fotografía. Introduce los datos manualmente.");
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      if (activo.current) setLeyendo(false);
    }
  };

  return (
    <section className="zori-ocr-capture" aria-label="Captura automática de la cédula">
      <div className="zori-ocr-heading">
        <strong>1. Escanear cédula</strong>
        <small>Opcional · reconocimiento local, sin subir la foto</small>
      </div>
      <label className="zori-ocr-trigger">
        <span aria-hidden="true">▣</span> {leyendo ? "Leyendo cédula…" : "Abrir cámara o seleccionar foto"}
        <input type="file" accept="image/*" capture="environment" disabled={leyendo}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) procesar(f); e.target.value = ""; }} />
      </label>
      {mensaje && <p className="zori-ocr-message" role="status">{mensaje}</p>}
    </section>
  );
}
