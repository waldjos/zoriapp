import test from "node:test";
import assert from "node:assert/strict";
import {rutaCatia,perfilCatia,sedeCatia,valorPSA} from "./catia.js";
test("ruta Catia separada y perfil autorizado",()=>{assert.deepEqual(rutaCatia(),["sedes","periferico_catia","pacientes"]);assert.equal(perfilCatia({sedeId:"domingo_luciani",rol:"medico",activo:true}),false);assert.equal(perfilCatia({sedeId:"periferico_catia",rol:"medico",activo:true}),true);assert.equal(sedeCatia({activa:false,jornadaId:"periferico-catia-2026",jornadaAnio:2026}),false);});
test("valores PSA sin truncar",()=>{assert.equal(valorPSA("1,5"),1.5);assert.equal(valorPSA(""),null);assert.throws(()=>valorPSA("3abc"));assert.throws(()=>valorPSA("-1"));});

import {fichaDesdeOCR} from "./catia.js";
test("OCR Catia normaliza la identidad y no inventa datos de contacto",()=>{
 const f=fichaDesdeOCR({cedula:"12345678",tipo:"E",nombre:"JUAN PÉREZ",fecha:"15/03/1960"});
 assert.equal(f.cedula,"12345678");assert.equal(f.tipoDocumento,"E");assert.equal(f.nombreCompleto,"Juan Pérez");assert.equal(f.fechaNacimiento,"15/03/1960");assert.equal(f.telefono,"");assert.equal(f.email,"");
});
test("OCR parcial o inválido deja campos vacíos",()=>{
 const f=fichaDesdeOCR({cedula:"abc",fecha:"31/02/1960"});assert.equal(f.cedula,"");assert.equal(f.fechaNacimiento,"");assert.equal(f.nombreCompleto,"");
});
