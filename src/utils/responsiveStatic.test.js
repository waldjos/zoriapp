import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const leer = (ruta) => readFileSync(resolve(ruta), "utf8");
test("tema claro se importa después de App.css en todas las rutas", () => {
  const app = leer("src/App.jsx");
  assert.match(app, /import "\.\/App\.css";\s*import "\.\/responsive-light\.css";/);
  const css = leer("src/responsive-light.css");
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css, /\.dashboard-page/);
  assert.match(css, /\.zori-registro/);
  assert.match(css, /\.main-nav--simple/);
});
test("la app respeta notch, barra inferior y scroll horizontal exclusivo en tablas", () => {
  const html = leer("index.html");
  const css = leer("src/responsive-light.css");
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /max-width:\s*370px/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /\.table-wrapper/);
});
test("nueva PWA usa cache distinto y conserva cola clínica de IndexedDB", () => {
  const sw = leer("public/sw.js");
  const preparación = leer("src/utils/prepararOffline.js");
  const cola = leer("src/utils/colaPacientesOffline.js");
  assert.match(sw, /registro-offline-2026-11-v6/);
  assert.match(preparación, /offline-paciente-v4/);
  assert.match(preparación, /hospital-domingo-luciani\\.jpg/);
  assert.match(preparación, /zoriak-logo-oficial\.svg/);
  assert.match(cola, /const BASE = "zoriapp-registros-offline-v1"/);
  assert.doesNotMatch(sw, /indexedDB\.deleteDatabase/);
});
test("Vite compila también para Safari anterior a 16.4", () => {
  const vite = leer("vite.config.js");
  assert.match(vite, /target:\s*"es2018"/);
  assert.match(vite, /cssTarget:\s*"safari13"/);
});
