import test from "node:test";
import assert from "node:assert/strict";
import {esFichaCatia,resumenCatia,fichaFilas,porcentajePSA} from "./reportesCatia.js";
const p={sedeId:"periferico_catia",jornadaId:"periferico-catia-2026",jornadaAnio:2026,psaTotal:"4",psaLibre:"1",tacto:{nodulos:"no"}};
test("estadísticas solo incluyen Catia 2026",()=>{assert.equal(esFichaCatia(p),true);assert.deepEqual(resumenCatia([p,{...p,sedeId:"domingo_luciani"},{...p,jornadaAnio:2025}]),{total:1,tacto:1,psa:1,libre:1,ambos:1,pendientes:0});assert.throws(()=>fichaFilas({...p,sedeId:"domingo_luciani"}));});
test("distingue pendiente de hallazgo negativo y calcula porcentaje sin inventar",()=>{assert.equal(fichaFilas({...p,tacto:undefined}).find(x=>x[1]==="Nódulos")[2],"Sin registrar");assert.equal(porcentajePSA(p),25);assert.equal(porcentajePSA({...p,psaLibre:"5"}),null);assert.equal(porcentajePSA({...p,psaTotal:"0"}),null);assert.equal(porcentajePSA({...p,psaLibre:""}),null);});
