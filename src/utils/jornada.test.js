import test from "node:test";
import assert from "node:assert/strict";
import { anioPaciente, filtroJornada } from "./jornada.js";

test("clasifica pacientes de jornadas distintas sin modificar expedientes", () => {
  const actual = { jornadaAnio: 2026, createdAt: {seconds: 1730000000} };
  const historico = { createdAt: {seconds: Date.parse("2025-10-01T12:00:00Z")/1000} };
  const sinFecha = { nombreCompleto: "Paciente de prueba" };
  assert.equal(anioPaciente(actual), 2026);
  assert.equal(anioPaciente(historico), 2025);
  assert.equal(anioPaciente(sinFecha), null);
  assert.equal(filtroJornada(actual,"2026"), true);
  assert.equal(filtroJornada(historico,"2026"), false);
  assert.equal(filtroJornada(historico,"2025"), true);
  assert.equal(filtroJornada(sinFecha,"sin-fecha"), true);
  assert.equal(filtroJornada(sinFecha,"2025"), false);
});
