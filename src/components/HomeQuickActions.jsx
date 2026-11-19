import { useNavigate } from "react-router-dom";
import ZoriIcon from "./ZoriIcon";

const TARJETAS = [
  { ruta: "/registro", titulo: "Registrar paciente", icono: "registrar-paciente", clase: "register" },
  { ruta: "/pacientes?periodo=2026", titulo: "Buscar paciente", icono: "buscar", clase: "search" },
  { ruta: "/pacientes?periodo=2026", titulo: "Jornada 2026", icono: "jornada-2026", clase: "current" },
  { ruta: "/pacientes?periodo=2025", titulo: "Histórico 2025", icono: "historico-2025", clase: "historic" },
];
const CLINICAS = [
  { ruta: "/mini-jornada", titulo: "Mini jornada", icono: "evaluacion" },
  { ruta: "/laboratorio", titulo: "Laboratorio y PSA", icono: "laboratorio" },
];
const GESTION = [
  { ruta: "/validar-resultados", titulo: "Validar resultados", icono: "ficha-paciente" },
  { ruta: "/importar-psa", titulo: "Importar PSA", icono: "laboratorio" },
  { ruta: "/dashboard", titulo: "Estadísticas", icono: "evaluacion" },
];

function Tarjeta({item, navegar, tipo="primary"}) {
  return (
    <button type="button" onClick={() => navegar(item.ruta)}
      className={tipo === "primary" ? `zori-design-action zori-design-action--${item.clase}` : "zori-design-secondary"}>
      <span className="zori-design-action-icon"><ZoriIcon name={item.icono} size={tipo==="primary" ? 34 : 29}/></span>
      <strong>{item.titulo}</strong>
    </button>
  );
}

export default function HomeQuickActions() {
  const navigate = useNavigate();
  return (
    <section className="zori-quick-section zori-design-actions" aria-label="Acciones de la jornada">
      <div className="zori-design-section-head">
        <h2 className="zori-quick-heading">¿Qué necesitas hacer?</h2>
        <span aria-hidden="true" />
      </div>
      <div className="zori-design-primary-grid">
        {TARJETAS.map(item => <Tarjeta key={item.titulo} item={item} navegar={navigate}/>)}
      </div>
      <button type="button" className="zori-design-tacto" onClick={() => navigate("/tacto")}>
        <ZoriIcon name="urologia" size={46} strokeWidth={1.7} className="zori-design-tacto-symbol"/>
        <span className="zori-design-tacto-copy">
          <strong>Evaluación de tacto</strong>
          <small>Registrar hallazgos</small>
        </span>
        <span className="zori-design-tacto-next" aria-hidden="true"><ZoriIcon name="siguiente" size={27}/></span>
      </button>
      <div className="zori-design-secondary-grid">
        {CLINICAS.map(item => <Tarjeta key={item.titulo} item={item} navegar={navigate} tipo="secondary"/>)}
      </div>
      <details className="zori-quick-advanced zori-design-management">
        <summary>Administración y resultados</summary>
        <div className="zori-design-secondary-grid">
          {GESTION.map(item => <Tarjeta key={item.titulo} item={item} navegar={navigate} tipo="secondary"/>)}
        </div>
      </details>
      <p className="zori-years-note">Los expedientes sin fecha identificable permanecen en Pacientes → Sin clasificar.</p>
    </section>
  );
}
