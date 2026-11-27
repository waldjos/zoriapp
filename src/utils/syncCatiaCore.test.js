import test from "node:test";
import assert from "node:assert/strict";
import {camposRegistro,capturaVigente,validarColaCatia,registroCoincide,VIGENCIA_MS} from "./syncCatiaCore.js";
const d={...Object.fromEntries(camposRegistro.map(k=>[k,""])),sedeId:"periferico_catia",jornadaId:"periferico-catia-2026",jornadaAnio:2026,creadoPor:"medico-sintetico",tipoDocumento:"V",cedula:"99999999"};
test("ruta fija y sin mezcla de sede o cuenta",()=>{assert.equal(validarColaCatia(d,d.creadoPor),"periferico-catia-2026-V-99999999");assert.throws(()=>validarColaCatia(d,"otra"));assert.throws(()=>validarColaCatia({...d,sedeId:"domingo_luciani"},d.creadoPor));assert.throws(()=>validarColaCatia({...d,tacto:{}},d.creadoPor));});
test("reintento no altera expediente",()=>{assert.ok(registroCoincide({...d,tacto:{}},d));assert.ok(!registroCoincide({...d,nombreCompleto:"Otro"},d));});
test("autorización temporal solo en sesión",()=>{assert.equal(capturaVigente(100,101),true);assert.equal(capturaVigente(100,100+VIGENCIA_MS),false);assert.equal(capturaVigente(100,99),false);assert.equal(capturaVigente(null),false);});
