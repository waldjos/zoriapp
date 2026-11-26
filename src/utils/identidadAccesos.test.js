import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = ruta => readFileSync(ruta, "utf8");

test("Cerrar sesión permanece en Más con verificación de pendientes", () => {
  const app = leer("src/App.jsx");
  const menu = leer("src/components/MainNav.jsx");
  assert.match(app, /MainNav onLogout=\{salir\}/);
  assert.match(app, /pendientesLocales\(user\.uid\)/);
  assert.doesNotMatch(app, /<header className="app-header">/);
  assert.match(menu, /main-nav-logout/);
  assert.match(menu, /onClick=\{onLogout\}/);
});

test("Evaluación de tacto se destaca debajo de las cuatro tarjetas", () => {
  const acciones = leer("src/components/HomeQuickActions.jsx");
  assert.match(acciones, /zori-design-primary-grid/);
  assert.match(acciones, /zori-design-tacto/);
  assert.match(acciones, /navigate\("\/tacto"\)/);
  assert.ok(acciones.indexOf('TARJETAS.filter') >= 0 && acciones.indexOf('TARJETAS.filter') < acciones.indexOf("zori-design-tacto"));
  const clinicas = acciones.split("const CLINICAS =")[1]?.split("const GESTION")[0] || "";
  assert.doesNotMatch(clinicas, /Evaluación de tacto/);
});

test("foto del hospital usa JPEG nativo, marcas oficiales y composición aprobada", () => {
  const identidad = leer("src/components/IdentidadJornada.jsx");
  const css = leer("src/zori-design-fidelidad.css");
  assert.ok(identidad.includes('src="/branding/hospital-domingo-luciani.jpg"'));
  assert.ok(identidad.includes('className="zori-design-hospital-photo-fallback"'));
  assert.ok(identidad.includes('onError={() => setFotoDisponible(false)}'));
  assert.ok(identidad.includes('/branding/zoriak-logo-oficial.svg'));
  assert.match(css, /--zori-lime: #78c82d/);
  assert.match(css, /zori-design-hospital-head/);
});

test("login real y navegación utilizan iconos del kit", () => {
  const login = leer("src/pages/Login.jsx");
  const iconos = leer("src/components/ZoriIcon.jsx");
  assert.match(login, /await login\(email\.trim\(\), password\)/);
  assert.match(login, /PatrocinanteZoriak/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(iconos, /registrar-paciente/);
  assert.match(iconos, /urologia/);
  assert.match(iconos, /laboratorio/);
});
