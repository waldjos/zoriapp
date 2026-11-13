import { useCallback, useEffect, useState } from "react";
import { EVENTO_COLA, pendientesLocales } from "../utils/colaPacientesOffline";
import { sincronizarPendientes } from "../utils/sincronizarPacientes";
import { comprobarPreparacionOffline, prepararOffline } from "../utils/prepararOffline";

/** Visibilidad local de registros pendientes; otros dispositivos no pueden verlos sin conexión. */
export default function EstadoSincronizacion({ user }) {
  const [pendientes, setPendientes] = useState([]);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [verLista, setVerLista] = useState(false);
  const [inicializado, setInicializado] = useState(false);
  const [archivosOffline, setArchivosOffline] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [avanceDescarga, setAvanceDescarga] = useState(0);
  const uid = user?.uid;

  const preparar = async () => {
    setPreparando(true);
    setAvanceDescarga(0);
    setMensaje("Descargando motor OCR, idioma español y aplicación para uso sin internet…");
    try {
      await prepararOffline(setAvanceDescarga);
      setArchivosOffline(true);
      setMensaje("Archivos descargados. Cierra y abre ZoriApp, y realiza una prueba en modo avión antes de la jornada.");
    } catch (error) {
      setArchivosOffline(false);
      setMensaje(error?.message || "No se pudo preparar el modo offline. Comprueba tu conexión.");
    } finally {
      setPreparando(false);
    }
  };

  const actualizar = useCallback(async () => {
    if (!uid) return;
    try {
      setPendientes(await pendientesLocales(uid));
      setInicializado(true);
    } catch {
      setMensaje("Este dispositivo no pudo acceder al almacenamiento local seguro.");
      setInicializado(true);
    }
  }, [uid]);

  const sincronizar = useCallback(async (automatico = false) => {
    if (!uid || !navigator.onLine) return;
    setEnviando(true);
    if (!automatico) setMensaje("Enviando pendientes a Firebase…");
    try {
      const resultado = await sincronizarPendientes(uid, () => { actualizar(); });
      await actualizar();
      if (resultado.errores.length) setMensaje(resultado.errores[0]);
      else if (resultado.enviados) setMensaje(String(resultado.enviados) + " registro(s) confirmado(s) en Firebase.");
      else if (!automatico) setMensaje("No hay registros pendientes para enviar.");
    } catch {
      setMensaje("La sincronización no se completó. Los registros siguen en este dispositivo.");
    } finally {
      setEnviando(false);
    }
  }, [uid, actualizar]);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelado = false;
    comprobarPreparacionOffline().then(setArchivosOffline).catch(() => setArchivosOffline(false));
    actualizar().then(() => {
      if (!cancelado && navigator.onLine) sincronizar(true);
    });
    const refrescar = () => {
      setEnLinea(navigator.onLine);
      actualizar();
    };
    const reconectar = () => {
      setEnLinea(true);
      sincronizar(true);
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        refrescar();
        if (navigator.onLine) sincronizar(true);
      }
    };
    const cambioCola = () => {
      refrescar();
      if (navigator.onLine) sincronizar(true);
    };
    window.addEventListener(EVENTO_COLA, cambioCola);
    window.addEventListener("online", reconectar);
    window.addEventListener("offline", refrescar);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_COLA, cambioCola);
      window.removeEventListener("online", reconectar);
      window.removeEventListener("offline", refrescar);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [uid, actualizar, sincronizar]);

  if (!uid) return null;

  return (
    <section className="zori-sync-panel" aria-label="Estado de los registros sin conexión">
      <div className="zori-sync-top">
        <div>
          <strong className="zori-sync-title">
            {enLinea ? "● Con conexión" : "● Sin internet"} · {inicializado ? pendientes.length : "…"} pendientes
          </strong>
          <span className="zori-sync-note">
            {enLinea ? "Enviado solo cuando Firebase confirma la recepción." :
              "Puedes seguir registrando: los datos quedarán en este teléfono."}
          </span>
        </div>
        <div className="zori-sync-actions">
          {pendientes.length > 0 && (
            <button type="button" className="zori-sync-toggle" onClick={() => setVerLista(!verLista)}
              aria-expanded={verLista}>{verLista ? "Ocultar" : "Ver pendientes"}</button>
          )}
          <button className="zori-sync-button" type="button"
            disabled={!enLinea || enviando || pendientes.length === 0}
            onClick={() => sincronizar(false)}>{enviando ? "Sincronizando…" : "Sincronizar ahora"}</button>
        </div>
      </div>
      <div className="zori-sync-preparar">
        {archivosOffline
          ? <span className="zori-sync-ready">✓ Archivos de la app y OCR descargados para uso offline</span>
          : <span className="zori-sync-ready">Prepara este teléfono con internet antes de la jornada.</span>}
        <button type="button" className="zori-sync-toggle" onClick={preparar}
          disabled={!enLinea || preparando}>
          {preparando ? "Descargando " + avanceDescarga + "%" : archivosOffline ? "Actualizar archivos offline" : "Preparar modo offline"}
        </button>
      </div>
      {mensaje && <p role="status" className="zori-sync-message">{mensaje}</p>}
      {verLista && pendientes.length > 0 && (
        <ol className="zori-sync-list">
          {pendientes.map((registro) => (
            <li key={registro.id}>
              <span>
                {registro.datos?.nombreCompleto || "Ficha pendiente de revisión"}
                <small>
                  Cédula: •••{registro.datos?.cedula?.slice(-4) || "----"} ·
                  {" "}{new Date(registro.fechaLocal).toLocaleString("es-VE")}
                </small>
              </span>
              <strong>{registro.error ? "Revisión" : "Pendiente"}</strong>
            </li>
          ))}
        </ol>
      )}
      {pendientes.length > 0 && (
        <small className="zori-sync-warning">
          No desinstales la app ni borres sus datos hasta tener 0 pendientes.
          Las fichas sin internet solo están en este teléfono; otro dispositivo no puede verlas.
        </small>
      )}
    </section>
  );
}
