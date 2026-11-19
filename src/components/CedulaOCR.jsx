import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { extraerCedulaVenezolana } from "../utils/cedulaVenezolanaOCR";
import { prepararLecturasAdicionales } from "../utils/mejorarFotoCedula";
import { rotarFotoCedulaLocal } from "../utils/rotarFotoCedula";

/**
 * OCR en el dispositivo: no guarda la foto ni la envía al servidor.
 * Los valores extraídos siempre requieren confirmación de la persona que registra.
 */
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
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        cacheMethod: "write",
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
      const extraido = extraerCedulaVenezolana(resultado.data?.text || "");

      // Nunca formar un nombre juntando nombres de una lectura con apellidos de
      // otra: ambas partes tienen que salir coherentemente de la MISMA pasada OCR.
      const incorporar = (candidato) => {
        if (!candidato) return;
        const mismoDocumento = !extraido.cedula || !candidato.cedula ||
          extraido.cedula === candidato.cedula;
        if (!mismoDocumento) return;
        if (!extraido.cedula && candidato.cedula) {
          extraido.cedula = candidato.cedula;
          extraido.tipo = candidato.tipo;
        }
        if (!extraido.fecha && candidato.fecha) extraido.fecha = candidato.fecha;
        if ((!extraido.nombres || !extraido.apellidos) &&
            candidato.nombres && candidato.apellidos) {
          extraido.nombres = candidato.nombres;
          extraido.apellidos = candidato.apellidos;
        }
      };

      // Si la cédula fue fotografiada de costado, leerla en ambas orientaciones.
      // Solo se hacen estas pasadas adicionales cuando el nombre NO es fiable.
      if (!extraido.nombres || !extraido.apellidos) {
        if (activo.current) setMensaje("Comprobando orientación de la cédula…");
        for (const grados of [-90, 90]) {
          if (extraido.nombres && extraido.apellidos) break;
          const orientada = await rotarFotoCedulaLocal(procesada, grados);
          if (!orientada) continue;
          try {
            const lectura = await trabajador.recognize(orientada);
            incorporar(extraerCedulaVenezolana(lectura.data?.text || ""));
          } catch { /* otras orientaciones y escritura manual siguen disponibles */ }
        }
      }

      if (!extraido.nombres || !extraido.apellidos) {
        if (activo.current) setMensaje("Realzando el texto de nombres y apellidos…");
        const variantes = await prepararLecturasAdicionales(
          procesada, resultado.data?.words, extraido.cedula, extraido.fecha
        );
        try { await trabajador.setParameters({ tessedit_pageseg_mode: "6" }); }
        catch { /* conservar modo previo si el dispositivo no lo admite */ }
        for (const variante of variantes) {
          if (extraido.nombres && extraido.apellidos) break;
          try {
            const lectura = await trabajador.recognize(variante);
            incorporar(extraerCedulaVenezolana(lectura.data?.text || ""));
          } catch { /* nunca aceptar resultados dudosos ni perder datos previos */ }
        }
      }

      // Recalcular el estado después de todas las lecturas. No afirmar éxito
      // cuando solo se detectó texto con aspecto de nombre pero sin validación.
      extraido.nombre = extraido.nombres && extraido.apellidos
        ? extraido.nombres + " " + extraido.apellidos : "";
      extraido.incompletos = [
        !extraido.cedula && "cédula",
        !extraido.nombres && "nombres",
        !extraido.apellidos && "apellidos",
        !extraido.fecha && "nacimiento",
      ].filter(Boolean);

      if (activo.current) {
        onExtract(extraido);
        setProgreso(100);
        setMensaje(extraido.cedula || extraido.nombre
          ? extraido.incompletos.length
            ? "Se reconocieron algunos datos. Revisa los campos y completa: " + extraido.incompletos.join(", ") + "."
            : "Se reconocieron cédula, nombres, apellidos y nacimiento. Confirma los valores antes de guardar."
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
