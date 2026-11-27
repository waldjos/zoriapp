import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("panel de transición consulta únicamente sedes desde servidor",()=>{
 const p=read("src/pages/PanelCentral.jsx");
 assert.match(p,/getDocsFromServer\(collection\(db,"sedes"\)\)/);
 assert.doesNotMatch(p,/(setDoc|updateDoc|deleteDoc|addDoc|collection\(db,"pacientes"\))/);
 assert.match(p,/if\(!autorizado\)/);
});
test("perfil administrativo activo y confirmado por servidor",()=>{
 const p=read("src/utils/usePanelCentral.js");
 assert.match(p,/!snap.metadata.fromCache/);
 assert.match(p,/p\?\.rol==="superadmin"/);
 assert.match(p,/p\?\.activo===true/);
});
test("ruta protegida y fallback Vercel",()=>{
 assert.match(read("src/App.jsx"),/path="\/superadmin" element=\{<PrivateRoute><PanelCentral/);
 assert.ok(JSON.parse(read("vercel.json")).rewrites.some(x=>x.source==="/superadmin"&&x.destination==="/index.html"));
});

test("afiliación solo crea perfiles médicos faltantes, no toca expedientes",()=>{const s=read("src/components/AfiliarLuciani.jsx");assert.match(s,/runTransaction/);assert.match(s,/if\(!s.exists\(\)\)/);assert.match(s,/sedeId,rol:"medico",activo:true/);assert.match(s,/\["domingo_luciani","periferico_catia"\]\.includes\(sedeId\)/);assert.match(s,/s\.data\(\)\.sedeId!==sedeId/);assert.doesNotMatch(s,/"pacientes"|deleteDoc|updateDoc/);});
