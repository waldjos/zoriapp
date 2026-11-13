/**
 * Cola local privada para el Registro Express.
 * Solo se guardan datos de registro; NUNCA se almacenan fotografías o resultados clínicos.
 * AES-GCM con CryptoKey no exportable guardada en IndexedDB. Requiere navegador seguro.
 * La protección no sustituye el bloqueo/cifrado del teléfono ni evita el XSS.
 */
const BASE = "zoriapp-registros-offline-v1";
const CAMBIO = "zoriapp-cola-cambio";
let apertura;
let llavePendiente;

function solicitud(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Fallo de IndexedDB"));
  });
}

export function avisarCola() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CAMBIO));
}
export const EVENTO_COLA = CAMBIO;

function abrir() {
  if (!("indexedDB" in window) || !window.crypto?.subtle || !window.crypto?.randomUUID) {
    return Promise.reject(new Error("Este navegador no permite almacenamiento local cifrado seguro."));
  }
  if (!apertura) {
    apertura = new Promise((resolve, reject) => {
      const req = indexedDB.open(BASE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("registros")) db.createObjectStore("registros", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("No se pudo abrir la cola offline."));
      req.onblocked = () => reject(new Error("Cierra las otras pestañas de ZoriApp para activar el modo offline."));
    }).catch((e) => { apertura = null; throw e; });
  }
  return apertura;
}

async function leer(almacen, id) {
  const db = await abrir();
  return solicitud(db.transaction(almacen, "readonly").objectStore(almacen).get(id));
}
async function guardar(almacen, objeto) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(almacen, "readwrite", { durability: "strict" });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al guardar la ficha local."));
    tx.onabort = () => reject(tx.error || new Error("La escritura local fue cancelada."));
    tx.objectStore(almacen).put(objeto);
  });
}
async function quitar(almacen, id) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(almacen, "readwrite", { durability: "strict" });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al borrar registro ya confirmado."));
    tx.onabort = () => reject(tx.error || new Error("La eliminación local fue cancelada."));
    tx.objectStore(almacen).delete(id);
  });
}

async function llave() {
  if (!llavePendiente) {
    llavePendiente = (async () => {
      const crearOLocalizar = async () => {
        const anterior = await leer("meta", "clave");
        if (anterior?.clave) return anterior.clave;
        const nueva = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
        await guardar("meta", { id: "clave", clave: nueva });
        return nueva;
      };
      // Impedir generar llaves distintas cuando se abre la misma app en dos pestañas.
      return navigator.locks?.request
        ? navigator.locks.request("zoriapp-offline-clave", crearOLocalizar)
        : crearOLocalizar();
    })().catch((error) => { llavePendiente = null; throw error; });
  }
  return llavePendiente;
}

export async function verificarAlmacenamientoOffline() {
  await abrir();
  await llave();
  // Pide almacenamiento persistente si el navegador lo admite; no es garantía absoluta.
  try { await navigator.storage?.persist?.(); } catch { /* el sistema puede denegarlo */ }
  return true;
}

export async function guardarPacienteLocal(datos, uid) {
  if (!uid) throw new Error("Debes iniciar sesión una vez con internet para utilizar el registro offline.");
  await verificarAlmacenamientoOffline();
  const id = "offline_" + crypto.randomUUID();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await llave();
  const contenido = new TextEncoder().encode(JSON.stringify(datos));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, contenido);
  await guardar("registros", {
    id, uid, fechaLocal: new Date().toISOString(),
    iv: [...iv], cifrado
  });
  avisarCola();
  return id;
}

export async function pendientesLocales(uid) {
  if (!uid) return [];
  const db = await abrir();
  const todos = await solicitud(db.transaction("registros", "readonly").objectStore("registros").getAll());
  const misRegistros = todos.filter((r) => r.uid === uid);
  const clave = misRegistros.length ? await llave() : null;
  const descifrados = [];
  for (const registro of misRegistros) {
    try {
      const datos = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(registro.iv) }, clave, registro.cifrado
      );
      descifrados.push({
        id: registro.id, uid: registro.uid,
        fechaLocal: registro.fechaLocal,
        datos: JSON.parse(new TextDecoder().decode(datos))
      });
    } catch {
      // Los errores de descifrado no borran el registro: preservar para diagnóstico.
      descifrados.push({ id: registro.id, uid: registro.uid, fechaLocal: registro.fechaLocal, error: "No se puede descifrar este registro. No borres los datos del navegador." });
    }
  }
  return descifrados.sort((a, b) => a.fechaLocal.localeCompare(b.fechaLocal));
}

export async function confirmarSincronizacion(id, uid) {
  const registro = await leer("registros", id);
  if (!registro || registro.uid !== uid) throw new Error("No es posible confirmar un registro de otra cuenta.");
  await quitar("registros", id);
  avisarCola();
}
