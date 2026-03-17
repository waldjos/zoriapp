import { useLocation, useNavigate } from "react-router-dom";

const NAV_LINKS = [
  { path: "/", label: "Inicio", matchPrefix: "/" },
  { path: "/registro", label: "Registro", matchPrefix: "/registro" },
  { path: "/tacto", label: "Tacto", matchPrefix: "/tacto" },
  { path: "/mini-jornada", label: "Mini jornada", matchPrefix: "/mini-jornada" },
  { path: "/pacientes", label: "Pacientes", matchPrefix: "/pacientes" },
  { path: "/laboratorio", label: "Laboratorio", matchPrefix: "/laboratorio" },
  { path: "/validar-resultados", label: "Validar resultados", matchPrefix: "/validar-resultados" },
  { path: "/dashboard", label: "Dashboard", matchPrefix: "/dashboard" },
  { path: "/importar-psa", label: "Importar PSA", matchPrefix: "/importar-psa" },
];

export default function MainNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="main-nav" aria-label="Navegación principal">
      <div className="main-nav-inner">
        {NAV_LINKS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.matchPrefix && location.pathname.startsWith(item.matchPrefix) && item.path !== "/");

          return (
            <button
              key={item.path}
              type="button"
              className={`main-nav-btn${isActive ? " main-nav-btn--active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

