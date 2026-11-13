import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

/**
 * OCR en el dispositivo: no guarda la foto ni la envía al servidor.
 * Los valores extraídos siempre requieren confirmación de la persona que registra.
 */
export function extraerCedula(texto) {
  const lineas = String(texto || "")
    .replace(/\r/g, "")
    .split(/\n/)
    .map((linea) => linea.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const lineaIdentificacion = lineas.find((linea) =>
    /c[eé]dula|identidad|(?:^|\s)[VE]\s*[-.:]?\s*\d[\d.\s-]{5,14}/i.test(linea)
  );

  const candidatos = [lineaIdentificacion, ...lineas].filter(Boolean);
  let tipo = null;
  let cedula = "";

  for (const linea of candidatos) {
    const match = linea.match(/(?:^|\s)([VE])\s*[-.:]?\s*(\d[\d.\s-]{5,14})/i) ||
      linea.match(/(?:c[eé]dula|n[uú]mero|identidad)\s*[:.\-]?\s*(\d[\d.\s-]{5,14})/i);
    if (!match) continue;
    const numero = (match[2] || match[1] || "").replace(/\D/g, "");
    if (numero.length < 6 || numero.length > 9) continue;
    cedula = numero;
    tipo = match[2] ? match[1].toUpperCase() : null;
    break;
  }

  // Si no reconoce la nacionalidad, prefiere dejar el campo sin inferir.
  // El texto OCR no sustituye la revisión visual del documento.
  const lineasNombre = lineas.filter((linea) =>
    !/rep[uú]blica|venezuela|bolivariana|identidad|c[eé]dula|nacionalidad|fecha|nacimiento|sexo|firma|expedici[oó]n|vencimiento|fotograf[ií]a|documento|autoridad|estado|\\d{4}/i.test(linea)
  );
  const nombre = lineasNombre
    .map((linea) => linea.replace(/[^\p{L}\s'’-]/gu, " ").replace(/\s+/g, " ").trim())
    .find((linea) => linea.split(" ").length >= 2 && linea.length >= 7) || "";

  // Una fecha cualquiera podría ser la expedición o vencimiento.
  // Solo prellenar si está claramente asociada con "nacimiento".
  let fecha = "";
  const idxNacimiento = lineas.findIndex((l) => /nacimiento|f\.\s*nac/i.test(l));
  if (idxNacimiento >= 0) {
    const cercano = lineas.slice(idxNacimiento, idxNacimiento + 2).join(" ");
    fecha = cercano.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/)?.[0] || "";
  }
  return { tipo, cedula, nombre, fecha };
}

async function reducirFotografia(archivo) {
  if (typeof createImageBitmap !== "function") return archivo;
  let imagen;
  try {
    imagen = await createImageBitmap(archivo);
    const mayorLado = Math.max(imagen.width, imagen.height);
    // Limitar la foto para reducir los errores de memoria en Android.
    if (mayorLado <= 1800) return archivo;
    const escala = 1800 / mayorLado;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagen.width * escala));
    canvas.height = Math.max(1, Math.round(imagen.height * escala));
    canvas.getContext("2d").drawImage(imagen, 0, 0, canvas.width, canvas.height);
    const comprimida = await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen.")), "image/jpeg", 0.9)
    );
    canvas.width = 0;
    canvas.height = 0;
    return comprimida;
  } catch {
    // Si la cámara genera un formato no compatible con ImageBitmap,
    // el motor OCR puede intentar leer la imagen original.
    return archivo;
  } finally {
    imagen?.close?.();
  }
}

export default function CedulaOCR({ onExtract }) {
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [progreso, setProgreso] = useState(0);
  const activo = useRef(true);

  useEffect(() => {
    activo.current = true;
    return () => { activo.current = false; };
  }, []);

  const procesar = async (archivo) => {
    if (!archivo || leyendo) return;
    if (!archivo.type.startsWith("image/")) {
      setMensaje("Selecciona una fotografía de la cédula.");
      return;
    }
    setLeyendo(true);
    setProgreso(0);
    setMensaje("Preparando lector local. La primera lectura puede necesitar internet para cargar el idioma…");
    let trabajador;
    let etapa = "inicio";

    try {
      const procesada = await reducirFotografia(archivo);
      etapa = "motor";
      // En Tesseract.js v4 createWorker devuelve una promesa.
      // Es imprescindible esperar al worker antes de invocar load().
      trabajador = await createWorker({
        logger: (evento) => {
          if (!activo.current) return;
          if (evento.status === "recognizing text" && Number.isFinite(evento.progress)) {
            setProgreso(Math.round(evento.progress * 100));
            setMensaje("Leyendo la cédula en este dispositivo…");
          }
        },
      });
      await trabajador.load();
      etapa = "idioma";
      await trabajador.loadLanguage("spa");
      await trabajador.initialize("spa");
      etapa = "lectura";
      const resultado = await trabajador.recognize(procesada);
      const extraido = extraerCedula(resultado.data?.text || "");

      if (activo.current) {
        onExtract(extraido);
        setProgreso(100);
        setMensaje(extraido.cedula || extraido.nombre
          ? "Lectura terminada. Revisa los datos detectados y completa los que falten."
          : "La fotografía se procesó, pero no se distinguieron los datos. Prueba con más luz, sin reflejos y acercando la cédula.");
      }
    } catch (error) {
      console.error("OCR local no disponible:", error?.name || "Error");
      if (activo.current) {
        if (etapa === "motor" || etapa === "idioma") {
          setMensaje("No se pudo iniciar el lector. Comprueba tu conexión a internet y vuelve a intentarlo; la carga inicial necesita descargar los recursos del OCR.");
        } else {
          setMensaje("No se pudo procesar esta foto. Intenta tomarla de frente, con buena luz y sin reflejos; también puedes escribir los datos.");
        }
      }
    } finally {
      if (trabajador) await trabajador.terminate().catch(() => {});
      if (activo.current) setLeyendo(false);
    }
  };

  return (
    <section className="zori-ocr-capture" aria-label="Captura automática de la cédula">
      <div className="zori-ocr-heading">
        <strong>1. Escanear cédula</strong>
        <small>Opcional · la imagen se procesa en tu dispositivo</small>
      </div>
      <label className="zori-ocr-trigger">
        <span aria-hidden="true">▣</span> {leyendo ? "Procesando fotografía…" : "Abrir cámara o seleccionar foto"}
        <input type="file" accept="image/*" capture="environment" disabled={leyendo}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) procesar(f); e.target.value = ""; }} />
      </label>
      {leyendo && <progress className="zori-ocr-progress" value={progreso} max={100} aria-label="Avance de lectura de cédula" />}
      {mensaje && <p className="zori-ocr-message" role="status">{mensaje}</p>}
    </section>
  );
}
