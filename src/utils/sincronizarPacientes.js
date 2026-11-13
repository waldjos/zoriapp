import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { pendientesLocales, confirmarSincronizacion } from "./colaPacientesOffline";

let sincronizacionEnCurso = null;

async function esperarConfirmacion(promesa, ms = 15000) {
  let temporizador;
  try {
    return await Promise.race([
      promesa,
      new Promise((_, reject) => {
        temporizador = setTimeout(() => reject(new Error("La conexión no confirmó el envío. El registro permanece guardado en el dispositivo.")), ms);
      }),
    ]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
    // Si el SDK continúa intentando enviar, el ID fijo impide duplicar el documento.
    promesa.catch(() => {});
  }
}

/**
 * Sincronización idempotente: el ID en Firestore es el mismo de la cola local.
 * No se borra nada del teléfono hasta recibir confirmación del servidor.
 */
export function sincronizarPendientes(uid, alAvanzar = () => {}) {
  if (!uid) return Promise.reject(new Error("Inicia sesión antes de sincronizar."));
  if (sincronizacionEnCurso) return sincronizacionEnCurso;

  sincronizacionEnCurso = (async () => {
    if (!navigator.onLine) return { enviados: 0, pendientes: (await pendientesLocales(uid)).length, errores: ["Sin conexión."] };
    const lista = await pendientesLocales(uid);
    const resultado = { enviados: 0, pendientes: lista.length, errores: [] };
    for (const registro of lista) {
      if (!registro.datos) {
        resultado.errores.push(registro.error || "Un registro cifrado requiere revisión.");
        break;
      }
      if (!navigator.onLine) {
        resultado.errores.push("Se perdió la conexión. Los registros restantes siguen en el dispositivo.");
        break;
      }

      try {
        const datos = registro.datos;
        const operacion = setDoc(doc(db, "pacientes", registro.id), {
          ...datos,
          jornadaAnio: datos.jornadaAnio || 2026,
          jornadaId: datos.jornadaId || "domingo-luciani-2026",
          creadoPor: uid,
          fechaCapturaLocal: registro.fechaLocal,
          createdAt: serverTimestamp(),
          origenRegistro: "registro-express-offline",
        });
        await esperarConfirmacion(operacion);
        await confirmarSincronizacion(registro.id, uid);
        resultado.enviados += 1;
        resultado.pendientes -= 1;
        alAvanzar(resultado);
      } catch (error) {
        resultado.errores.push(error?.code === "permission-denied"
          ? "Firebase rechazó el envío por permisos. El registro sigue guardado en el teléfono."
          : "Un registro no pudo confirmarse. Sigue guardado y puede reintentarse.");
        break; // Evitar reintentos repetidos mientras el servicio está fallando.
      }
    }
    return resultado;
  })().finally(() => { sincronizacionEnCurso = null; });
  return sincronizacionEnCurso;
}
