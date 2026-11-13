/** Producto original incluido en ZoriApp: /public/PROSILOD.jpg.
 * No recrear ni alterar el logotipo de Zoriak ni las características del empaque.
 */
export default function ProsilodBanner() {
  return (
    <aside className="zori-prosilod" aria-label="Prosilod 8 mg, información profesional del patrocinador">
      <div className="zori-prosilod-photo">
        <img src="/PROSILOD.jpg" alt="Empaque del medicamento Prosilod 8 mg de Zoriak" loading="eager" />
      </div>
      <div className="zori-prosilod-copy">
        <span className="zori-prosilod-kicker">Zoriak Pharma · Línea Salud Sexual y Urología</span>
        <h2>Prosilod <span>8 mg</span></h2>
        <p className="zori-prosilod-generic">Silodosina</p>
        <span className="zori-prosilod-tag">Información para profesionales de la salud</span>
        <small>Medicamento de prescripción. Consulte la ficha técnica y el registro sanitario aplicable.</small>
      </div>
    </aside>
  );
}
