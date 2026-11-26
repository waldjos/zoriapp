import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("referencias clínicas activas tienen sede explícita",()=>{
 for (const p of ["Home","Pacientes","PacienteDetalle","Dashboard","Tacto"]){
 const code=read("src/pages/"+p+".jsx");assert.doesNotMatch(code,/(collection|doc)\(db, "pacientes"/);assert.match(code,/\(db, "sedes", sede\.id, "pacientes"/);
 }
});
test("entorno de prueba no usa proyecto histórico y sincronización exige sede",()=>{
 assert.match(read("src/firebase.js"),/projectId !== "zoriapp-23b52"/);
 assert.match(read("src/utils/sincronizarPacientes.js"),/datos\.sedeId !== perfil\.sedeId/);
 assert.match(read("firestore.multisede.rules"),/allow read: if clinician\(s\)/);
});
