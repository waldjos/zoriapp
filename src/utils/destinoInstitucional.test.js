import test from "node:test";
import assert from "node:assert/strict";
import {destinoInstitucional as destino} from "./destinoInstitucional.js";
test("solo sedes y roles activos autorizados",()=>{
 assert.equal(destino({rol:"medico",sedeId:"periferico_catia",activo:true}),"catia");
 assert.equal(destino({rol:"medico",sedeId:"domingo_luciani",activo:true}),"luciani");
 assert.equal(destino({rol:"superadmin",activo:true}),"admin");
 for(const p of [null,{}, {rol:"medico",sedeId:"periferico_catia",activo:false},{rol:"medico",sedeId:"perez_carreno",activo:true},{rol:"otro",activo:true}])assert.equal(destino(p),"denegado");
});
