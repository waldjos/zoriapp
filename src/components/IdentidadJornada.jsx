import { useState } from "react";
import { HOSPITAL_FOTO_JPEG } from "../assets/hospitalFoto";

const ZORIAK_OFICIAL = "/branding/zoriak-logo-oficial.svg";

export function PatrocinanteZoriak({ compact = false }) {
  const [visible, setVisible] = useState(true);
  return (
    <div className={`zori-design-patrocinio${compact ? " zori-design-patrocinio--compact" : ""}`}>
      <span>Con el apoyo de</span>
      <a href="https://zoriakpharma.com/" target="_blank" rel="noopener noreferrer"
        className="zori-design-logo-patrocinante" aria-label="Zoriak Pharma">
        {visible
          ? <img src={ZORIAK_OFICIAL} alt="Zoriak Pharma" loading="eager"
              onError={() => setVisible(false)} />
          : <strong>Zoriak Pharma</strong>}
      </a>
      <em>Tu círculo de confianza</em>
    </div>
  );
}

export default function IdentidadJornada() {
  return (
    <div className="zori-design-institucional">
      <section className="zori-design-brand-header" aria-label="ZoriApp y patrocinio">
        <img src="/branding/zoriapp-2026.svg" alt="ZoriApp · Gestión de jornadas médicas"
          className="zori-design-logo-app" />
        <PatrocinanteZoriak />
      </section>
      <section className="zori-design-hospital" aria-label="Hospital Dr. Domingo Luciani">
        <header className="zori-design-hospital-head">
          <img src="/branding/ivss-original.svg" alt="IVSS" />
          <div>
            <span>Instituto Venezolano de los Seguros Sociales</span>
            <strong>Hospital Dr. Domingo Luciani</strong>
            <small>Jornada médica 2026 · El Llanito, Petare</small>
          </div>
        </header>
        <img className="zori-design-hospital-photo" src={HOSPITAL_FOTO_JPEG}
          alt="Fachada del Hospital Dr. Domingo Luciani" loading="eager" />
      </section>
    </div>
  );
}
