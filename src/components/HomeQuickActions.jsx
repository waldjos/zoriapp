import { useNavigate } from "react-router-dom";

const TARJETAS = [
  { ruta: "/registro", titulo: "Registrar paciente", descripcion: "Escanear cédula y guardar sin internet", simbolo: "+", clase: "primary" },
  { ruta: "/pacientes?periodo=2026", titulo: "Buscar paciente", descripcion: "Consultar o corregir fichas", simbolo: "⌕" },
  { ruta: "/pacientes?periodo=2026", titulo: "Jornada 2026", descripcion: "Registros de la jornada actual", simbolo: "26", clase: "current" },
  { ruta: "/pacientes?periodo=2025", titulo: "Histórico 2025", descripcion: "Consultar registros anteriores", simbolo: "25", clase: "historic" },
];

const CLINICAS = [
  { ruta: "/tacto", titulo: "Evaluación de tacto", descripcion: "Registrar hallazgos", simbolo: "✓" },
  { ruta: "/mini-jornada", titulo: "Mini jornada", descripcion: "Atención rápida", simbolo: "↗" },
  { ruta: "/laboratorio", titulo: "Laboratorio y PSA", descripcion: "Resultados de pacientes", simbolo: "＋" },
];

const GESTION = [
  { ruta: "/validar-resultados", titulo: "Validar resultados", descripcion: "Revisar expedientes", simbolo: "✓" },
  { ruta: "/importar-psa", titulo: "Importar PSA", descripcion: "Cargar archivo de laboratorio", simbolo: "↑" },
  { ruta: "/dashboard", titulo: "Estadísticas", descripcion: "Panel clínico", simbolo: "▥" },
];

function Accion({ ruta, titulo, descripcion, simbolo, clase = "", navegar }) {
  return (
    <button className={`zori-quick-tile zori-quick-tile--${clase || "secondary"}`}
      type="button" onClick={() => navegar(ruta)}>
      <span className="zori-quick-symbol" aria-hidden="true">{simbolo}</span>
      <span className="zori-quick-copy"><strong>{titulo}</strong><small>{descripcion}</small></span>
      <span className="zori-quick-chevron" aria-hidden="true">›</span>
    </button>
  );
}

export default function HomeQuickActions() {
  const navigate = useNavigate();
  const ver = (lista) => lista.map((item) => <Accion key={item.titulo} {...item} navegar={navigate} />);
  return (
    <section className="zori-quick-section" aria-label="Acciones de la jornada">
      <h2 className="zori-quick-heading">¿Qué necesitas hacer?</h2>
      <div className="zori-quick-grid">{ver(TARJETAS)}</div>
      <p className="zori-years-note">Los registros se muestran por jornada. Los expedientes sin fecha identificable permanecen disponibles en «Pacientes → Sin clasificar».</p>
      <h2 className="zori-quick-heading zori-quick-heading--secondary">Herramientas clínicas</h2>
      <div className="zori-quick-grid zori-quick-grid--clinical">{ver(CLINICAS)}</div>
      <details className="zori-quick-advanced">
        <summary>Administración y resultados</summary>
        <div className="zori-quick-grid">{ver(GESTION)}</div>
      </details>
    </section>
  );
}
