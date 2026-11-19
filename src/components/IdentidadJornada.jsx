import { useState } from "react";

// Copia literal del SVG oficial, recuperada durante la compilación si está disponible.
const LOGO_OFICIAL_ZORIAK = "/branding/zoriak-logo-oficial.svg";

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
          <span className="zori-branding-sponsor-identity">
            {logoDisponible && <img src={LOGO_OFICIAL_ZORIAK} alt=""
              aria-hidden="true" onError={() => setLogoDisponible(false)} />}
            <strong className="zori-sponsor-name">Zoriak Pharma</strong>
          </span>
          <span className="zori-branding-sponsor-tagline">Tu círculo de confianza</span>
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
