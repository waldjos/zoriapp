import test from "node:test";
import assert from "node:assert/strict";
import { nombrePropio, cedulaVE, telefonoE164VE, correoNormalizado, fechaNacimientoISO, fechaParaFormulario, mascaraFechaRapida, edadDesdeFecha } from "./registroExpress.js";

test("teléfonos móviles VE con separadores y prefijo internacional", () => {
  assert.equal(telefonoE164VE("0424.123-45 67"), "+584241234567");
  assert.equal(telefonoE164VE("+58 (412) 123-45-67"), "+584121234567");
  assert.equal(telefonoE164VE("0058 416 1234567"), "+584161234567");
  assert.equal(telefonoE164VE(""), "");
  assert.throws(() => telefonoE164VE("0412.12"));
  assert.throws(() => telefonoE164VE("0412123456789"));
  assert.throws(() => telefonoE164VE("0412x1234567"));
});

test("cédulas V/E respetando el documento y sin separadores", () => {
  assert.deepEqual(cedulaVE("E-12.345.678", "V"),
    {cedula:"12345678", tipoDocumento:"E", etiqueta:"E-12345678"});
  assert.equal(cedulaVE("12345678", "V").etiqueta, "V-12345678");
  assert.throws(() => cedulaVE("12A34567", "V"));
});

test("nombres y correos", () => {
  assert.equal(nombrePropio(" MARÍA   josÉ PÉREZ de la cruz "), "María José Pérez De La Cruz");
  assert.equal(nombrePropio("ana-maría o'neill"), "Ana-María O'Neill");
  assert.equal(correoNormalizado("  NOMBRE.APELLIDO@GMAIL.COM "), "nombre.apellido@gmail.com");
  assert.throws(() => correoNormalizado("no es correo"));
});

test("fecha rápida, edad y validación de días reales", () => {
  assert.equal(mascaraFechaRapida("29022000"), "29/02/2000");
  assert.equal(fechaNacimientoISO("29/02/2000", new Date("2026-11-12T12:00:00")), "2000-02-29");
  assert.equal(fechaParaFormulario("2000-02-29"), "29/02/2000");
  assert.equal(edadDesdeFecha("2000-12-20", new Date("2026-11-12T12:00:00")), 25);
  assert.throws(() => fechaNacimientoISO("31/02/2000"));
  assert.throws(() => fechaNacimientoISO("12/11/2999"));
});
