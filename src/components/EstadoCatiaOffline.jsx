import {useCallback,useEffect,useState,useRef} from "react";
import {EVENTO_COLA,pendientesLocales,verificarAlmacenamientoOffline} from "../utils/colaCatiaOffline";
import {sincronizarCatia} from "../utils/sincronizarCatia";
export default function EstadoCatiaOffline({uid,abierta,habilitar,preparada}){
 const [n,setN]=useState(null),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const enCurso=useRef(false),abiertaRef=useRef(abierta);
 abiertaRef.current=abierta;
 const refrescar=useCallback(async()=>{try{setN((await pendientesLocales(uid)).length);}catch{setN(null);}},[uid]);
 const sync=useCallback(async()=>{
  if(!abiertaRef.current||!navigator.onLine||enCurso.current)return;
  enCurso.current=true;setBusy(true);
  try{const r=await sincronizarCatia(uid);if(r.error||r.enviados)setMsg(r.error||r.enviados+" ficha(s) confirmadas en Firebase.");}
  catch{setMsg("No se completó la sincronización; se conservan las fichas.");}
  finally{await refrescar();enCurso.current=false;setBusy(false);}
 },[uid,refrescar]);
 useEffect(()=>{
  const cambio=()=>{refrescar();sync();};refrescar();if(abierta)sync();
  window.addEventListener(EVENTO_COLA,cambio);window.addEventListener("online",cambio);
  const timer=setInterval(()=>{if(navigator.onLine)sync();},30000);
  return()=>{window.removeEventListener(EVENTO_COLA,cambio);window.removeEventListener("online",cambio);clearInterval(timer);};
 },[abierta,refrescar,sync]);
 async function preparar(){
  setMsg("");try{await verificarAlmacenamientoOffline();habilitar(true);await refrescar();setMsg("Almacenamiento cifrado preparado para esta sesión. Mantén abierta la app.");}
  catch{habilitar(false);setMsg("No se pudo preparar almacenamiento cifrado en este navegador.");}
 }
 return <section className="cat-card cat-offline"><h2>Registro sin conexión</h2><p>{n===null?"Cola no comprobada":n+" ficha(s) pendientes"} · {preparada?"Almacenamiento preparado":"Preparación pendiente"}</p><button type="button" disabled={!abierta||busy} onClick={preparar}>Preparar registro offline</button><button type="button" disabled={!abierta||busy||!n} onClick={sync}>{busy?"Sincronizando…":"Sincronizar ahora"}</button><p role="status">{msg}</p><small>Solo captura de fichas. No cierres ni recargues la app durante una interrupción; no borres datos del navegador si hay pendientes. La foto no se guarda. Se requiere reconexión y jornada abierta para enviar.</small></section>;
}
