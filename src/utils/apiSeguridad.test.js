import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ocr from "../../api/ocr-space.js";
import sms from "../../api/send-sms.js";
import {coincidenciaPSASegura} from "./pdfParser.js";
test("API externas no aceptan datos ni realizan peticiones",()=>{
 for(const [fn,code] of [[ocr,410],[sms,503]])for(const method of ["GET","POST","PUT"]){
  let status,headers={};
  const res={setHeader:(k,v)=>headers[k]=v,status:n=>{status=n;return res;},json:x=>x};
  const result=fn({method},res);
  assert.equal(status,code);assert.equal(headers["Cache-Control"],"no-store");assert.ok(result.error);
 }
});
test("OCR local y carga PSA sin archivo público",()=>{
 assert.doesNotMatch(readFileSync("src/components/CedulaOCR.jsx","utf8"),/\/api\/ocr-space/);
 assert.doesNotMatch(readFileSync("src/pages/ImportarPSA.jsx","utf8"),/datos-psa\.txt|fetch\(/);
 const server=readFileSync("server.js","utf8");
 assert.ok(server.indexOf("Servicio auxiliar deshabilitado por seguridad.")<server.indexOf("app.post('/api/ocr-space'"));
});
test("PSA solo con coincidencia única, no parcial, y valores coherentes",()=>{
 const p={cedula:"99999998",nombreCompleto:"Paciente Ficticio"};
 const r={cedula:"99.999.998",nombre:"PACIENTE FICTICIO",psaTotal:4.2,psaLibre:0.8};
 assert.equal(coincidenciaPSASegura(p,[r],[p]),r);
 for(const [rows,patients] of [[[r,r],[p]],[[r],[p,p]],[[{...r,nombre:"Paciente"}],[p]],[[{...r,psaLibre:5}],[p]],[[{...r,cedula:"99999997"}],[p]]])assert.equal(coincidenciaPSASegura(p,rows,patients),null);
});
