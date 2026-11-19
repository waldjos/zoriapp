import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = (ruta) => readFileSync(ruta, "utf8");

test("cierre de sesión únicamente en menú Más conservando control de pendientes", () => {
  const app = leer("src/App.jsx");
  const menu = leer("src/components/MainNav.jsx");
  assert.match(app, /MainNav onLogout=\{salir\}/);
  assert.doesNotMatch(app, /<header className="app-header">/);
  assert.match(app, /pendientesLocales\(user\.uid\)/);
  assert.match(menu, /main-nav-logout/);
  assert.match(menu, /onClick=\{onLogout\}/);
});

test("Evaluación de tacto es acceso destacado único debajo de jornadas", () => {
  const acciones = leer("src/components/HomeQuickActions.jsx");
  assert.match(acciones, /className="zori-tacto-feature"/);
  assert.match(acciones, /navigate\("\/tacto"\)/);
  assert.ok(acciones.indexOf("ver(TARJETAS)") < acciones.indexOf("zori-tacto-feature"));
  const clinicas = acciones.split("const CLINICAS =")[1]?.split("const GESTION")[0] || "";
  assert.doesNotMatch(clinicas, /Evaluación de tacto/);
});

test("hospital usa fotografía local visible y marca oficial preservada sobre verde", () => {
  const identidad = leer("src/components/IdentidadJornada.jsx");
  const estilos = leer("src/responsive-light.css");
  assert.match(identidad, /hospital-luciani-foto\.svg/);
  assert.match(identidad, /zori-hospital-photo-frame/);
  assert.match(identidad, /zoriak-logo-oficial\.svg/);
  assert.match(estilos, /--zoriak-green: #00896e/);
  assert.match(estilos, /\.zori-hospital-photo\s*\{/);
  assert.doesNotMatch(identidad, /#152e68/);
});
