import test from "node:test";
import assert from "node:assert/strict";
import { extraerCedulaVenezolana } from "./cedulaVenezolanaOCR.js";

test("extrae nombres, apellidos y nacimiento incluso con etiqueta debajo", () => {
  const lectura = [
    "REPUBLICA BOLIVARIANA DE VENEZUELA",
    "CEDULA DE IDENTIDAD",
    "V 12.345.678",
    "APELLIDOS GARCÍA PÉREZ",
    "NOMBRES MARÍA ELENA",
    "04/09/1988 SOLTERA",
    "F. NACIMIENTO EDO CIVIL",
    "23/08/2025 08/2035",
    "F. EXPEDICION F. VENCIMIENTO",
  ].join("\n");
  const resultado = extraerCedulaVenezolana(lectura);
  assert.deepEqual({
    cedula: resultado.cedula,
    tipo: resultado.tipo,
    nombre: resultado.nombre,
    fecha: resultado.fecha,
    incompletos: resultado.incompletos
  }, {
    cedula: "12345678",
    tipo: "V",
    nombre: "MARÍA ELENA GARCÍA PÉREZ",
    fecha: "04/09/1988",
    incompletos: []
  });
});

test("ignora expedición cuando no hay etiqueta de nacimiento", () => {
  const lectura = "V 12.345.678\nAPELLIDOS GARCÍA PÉREZ\nNOMBRES MARÍA ELENA\n23/08/2025\nF EXPEDICION";
  const resultado = extraerCedulaVenezolana(lectura);
  assert.equal(resultado.fecha, "");
});

test("no rellena nombres con texto genérico o de mala calidad", () => {
  const lectura = "V 12.345.678\nREPUBLICA BOLIVARIANA DE VENEZUELA\nA A'RE -\nF. VENCIMIENTO";
  const resultado = extraerCedulaVenezolana(lectura);
  assert.equal(resultado.nombre, "");
  assert.ok(resultado.incompletos.includes("nombres"));
});
