import { useState } from "react";

const LOGO_OFICIAL_ZORIAK = "https://zoriakpharma.com/wp-content/uploads/2024/04/logo.svg";

export default function IdentidadJornada() {
  const [logoDisponible, setLogoDisponible] = useState(true);
  return (
    <section className="zori-branding" aria-label="Identidad de la jornada médica">
      <div className="zori-branding-top">
        <img className="zori-branding-logo" src="/branding/zoriapp-2026.svg"
          alt="ZoriApp — Gestión de jornadas médicas" />
        <a className="zori-branding-sponsor" href="https://zoriakpharma.com/"
          target="_blank" rel="noopener noreferrer" aria-label="Zoriak Pharma, patrocinante">
          <small>Con el apoyo de</small>
          {logoDisponible
            ? <img src={LOGO_OFICIAL_ZORIAK} alt="Zoriak Pharma"
                onError={() => setLogoDisponible(false)} />
            : <strong>Zoriak Pharma</strong>}
          <span>Tu círculo de confianza</span>
        </a>
      </div>
      <div className="zori-hospital-strip">
        <img src="/branding/ivss-original.svg" alt="IVSS" />
        <div>
          <span className="zori-hospital-eyebrow">Instituto Venezolano de los Seguros Sociales</span>
          <strong>Hospital Dr. Domingo Luciani</strong>
          <span>Jornada médica 2026 · El Llanito, Petare</span>
        </div>
      </div>
    </section>
  );
}
