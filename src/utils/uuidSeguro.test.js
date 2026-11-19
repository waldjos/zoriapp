import test from "node:test";
import assert from "node:assert/strict";
import { uuidSeguro } from "./uuidSeguro.js";

test("UUID usa API nativa si está disponible", () => {
  const esperado = "b4b7e70e-156d-483b-9696-05930419e331";
  assert.equal(uuidSeguro({ randomUUID: () => esperado }), esperado);
});
test("UUID v4 usa aleatoriedad criptográfica en Safari sin randomUUID", () => {
  const cryptoAntiguo = { getRandomValues: (v) => {
    for (let i = 0; i < v.length; i++) v[i] = i;
    return v;
  }};
  const valor = uuidSeguro(cryptoAntiguo);
  assert.match(valor, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(valor, "00010203-0405-4607-8809-0a0b0c0d0e0f");
});
test("UUID no utiliza generadores inseguros", () => {
  assert.throws(() => uuidSeguro({}), /criptográfica segura/);
});
