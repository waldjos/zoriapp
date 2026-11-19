import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ZoriIcon from "./ZoriIcon";

const PRINCIPALES = [
  { path: "/", label: "Inicio", icono: "inicio" },
  { path: "/registro", label: "Registrar", icono: "registrar-paciente" },
  { path: "/pacientes", label: "Pacientes", icono: "pacientes" },
];

const SECUNDARIAS = [
  { path: "/tacto", label: "Evaluación de tacto", grupo: "Atención médica" },
  { path: "/mini-jornada", label: "Mini jornada", grupo: "Atención médica" },
  { path: "/laboratorio", label: "Laboratorio", grupo: "Atención médica" },
  { path: "/validar-resultados", label: "Validar resultados", grupo: "Resultados y gestión" },
  { path: "/importar-psa", label: "Importar PSA", grupo: "Resultados y gestión" },
  { path: "/dashboard", label: "Estadísticas", grupo: "Resultados y gestión" },
];

export default function MainNav({ onLogout }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mostrarMas, setMostrarMas] = useState(false);
  const enMas = SECUNDARIAS.some(({ path }) => pathname === path);

  useEffect(() => setMostrarMas(false), [pathname]);

  const ir = (path) => {
    setMostrarMas(false);
    navigate(path);
  };

  return (
    <nav className="main-nav main-nav--simple" aria-label="Navegación principal de ZoriApp">
      <div className="main-nav-inner">
        {PRINCIPALES.map(({ path, label, icono }) => {
          const activo = path === "/" ? pathname === "/" : pathname === path || (path === "/pacientes" && pathname.startsWith("/pacientes/"));
          return (
            <button key={path} type="button"
              className={`main-nav-btn${activo ? " main-nav-btn--active" : ""}`}
              aria-current={activo ? "page" : undefined}
              onClick={() => ir(path)}>
              <span className="main-nav-icon" aria-hidden="true"><ZoriIcon name={icono} size={25}/></span>
              <span className="main-nav-label">{label}</span>
            </button>
          );
        })}
        <div className="main-nav-more">
          <button type="button"
            className={`main-nav-btn${enMas || mostrarMas ? " main-nav-btn--active" : ""}`}
            aria-expanded={mostrarMas} aria-controls="zoriapp-more-panel"
            onClick={() => setMostrarMas((anterior) => !anterior)}>
            <span className="main-nav-icon" aria-hidden="true"><ZoriIcon name="mas" size={25}/></span>
            <span className="main-nav-label">Más</span>
          </button>
          {mostrarMas && (
            <div className="main-nav-panel" id="zoriapp-more-panel" aria-label="Otras funciones">
              <div className="main-nav-panel-head">
                <strong>Más funciones</strong>
                <button type="button" className="main-nav-close" aria-label="Cerrar menú" onClick={() => setMostrarMas(false)}>×</button>
              </div>
              {["Atención médica", "Resultados y gestión"].map((grupo) => (
                <div className="main-nav-panel-group" key={grupo}>
                  <p className="main-nav-panel-label">{grupo}</p>
                  {SECUNDARIAS.filter((item) => item.grupo === grupo).map((item) => (
                    <button key={item.path} type="button"
                      className={`main-nav-panel-link${pathname === item.path ? " is-active" : ""}`}
                      onClick={() => ir(item.path)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
              <div className="main-nav-panel-group main-nav-session">
                <p className="main-nav-panel-label">Cuenta</p>
                <button
                  type="button"
                  className="main-nav-panel-link main-nav-logout"
                  onClick={onLogout}
                >
                  <ZoriIcon name="cerrar-sesion" size={19}/>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
