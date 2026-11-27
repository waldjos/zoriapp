import test from "node:test";
import assert from "node:assert/strict";
import {rutaCatia,perfilCatia,sedeCatia,valorPSA} from "./catia.js";
test("ruta Catia separada y perfil autorizado",()=>{assert.deepEqual(rutaCatia(),["sedes","periferico_catia","pacientes"]);assert.equal(perfilCatia({sedeId:"domingo_luciani",rol:"medico",activo:true}),false);assert.equal(perfilCatia({sedeId:"periferico_catia",rol:"medico",activo:true}),true);assert.equal(sedeCatia({activa:false,jornadaId:"periferico-catia-2026",jornadaAnio:2026}),false);});
test("valores PSA sin truncar",()=>{assert.equal(valorPSA("1,5"),1.5);assert.equal(valorPSA(""),null);assert.throws(()=>valorPSA("3abc"));assert.throws(()=>valorPSA("-1"));});
