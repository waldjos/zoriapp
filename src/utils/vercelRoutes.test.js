import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const routes = config.rewrites || [];

test("Vercel devuelve index.html para las rutas React Router en acceso directo", () => {
  for (const path of [
    "/login", "/registro", "/tacto", "/mini-jornada",
    "/pacientes", "/pacientes/:id", "/laboratorio",
    "/validar-resultados", "/dashboard", "/importar-psa",
  ]) {
    assert.ok(routes.some(r => r.source === path && r.destination === "/index.html"),
      `Falta fallback para ${path}`);
  }
});
test("Vercel no reescribe APIs ni recursos estáticos a HTML", () => {
  assert.ok(routes.every(r => r.source !== "/(.*)" && r.source !== "/:path*"));
  assert.ok(routes.every(r => !r.source.startsWith("/api") && !r.source.startsWith("/branding") && !r.source.startsWith("/assets")));
});
