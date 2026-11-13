import { useNavigate } from "react-router-dom";

const PRINCIPALES = [
  { ruta: "/registro", titulo: "Registrar paciente", descripcion: "Nuevo ingreso en pocos pasos", simbolo: "+", principal: true },
  { ruta: "/pacientes", titulo: "Buscar paciente", descripcion: "Consultar o corregir un registro", simbolo: "⌕" },
];

const CLINICOS = [
  { ruta: "/tacto", titulo: "Evaluación de tacto", descripcion: "Guardar hallazgos médicos", simbolo: "✓" },
  { ruta: "/mini-jornada", titulo: "Mini jornada", descripcion: "Atención y evaluación rápida", simbolo: "»" },
  { ruta: "/laboratorio", titulo: "Laboratorio", descripcion: "Ver o asociar resultados", simbolo: "▤" },
];

const HERRAMIENTAS = [
  { ruta: "/validar-resultados", titulo: "Validar resultados", descripcion: "Revisar expedientes", simbolo: "✓" },
  { ruta: "/importar-psa", titulo: "Importar PSA", descripcion: "Cargar datos de laboratorio", simbolo: "↑" },
  { ruta: "/dashboard", titulo: "Panel estadístico", descripcion: "Ver cifras de la jornada", simbolo: "▥" },
];

function TarjetaAccion({ ruta, titulo, descripcion, simbolo, principal = false, navegar }) {
  return (
    <button type="button"
      className={`zori-quick-tile${principal ? " zori-quick-tile--primary" : ""}`}
      onClick={() => navegar(ruta)}>
      <span className="zori-quick-symbol" aria-hidden="true">{simbolo}</span>
      <span>
        <strong>{titulo}</strong>
        <small>{descripcion}</small>
      </span>
    </button>
  );
}

export default function HomeQuickActions() {
  const navigate = useNavigate();
  const render = (acciones) => acciones.map((accion) => (
    <TarjetaAccion key={accion.ruta} {...accion} navegar={navigate} />
  ));

  return (
    <section className="zori-quick-section" aria-label="Acciones de la jornada">
      <h2 className="zori-quick-heading">¿Qué necesitas hacer?</h2>
      <div className="zori-quick-grid">{render(PRINCIPALES)}</div>

      <h2 className="zori-quick-heading" style={{ marginTop: "1.3rem" }}>Atención médica</h2>
      <div className="zori-quick-grid">{render(CLINICOS)}</div>

      <details className="zori-quick-advanced">
        <summary>Herramientas de gestión y resultados</summary>
        <div className="zori-quick-grid">{render(HERRAMIENTAS)}</div>
      </details>
      <p className="zori-quick-tip">
        Consejo: comienza por <strong>Registrar paciente</strong>.
        Para volver al inicio, utiliza la barra inferior.
      </p>
    </section>
  );
}
