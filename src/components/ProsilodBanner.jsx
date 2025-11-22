// src/components/ProsilodBanner.jsx
import React from "react";
import prosilodImg from "../assets/PROSILOD.jpg";

export default function ProsilodBanner() {
  return (
    <div className="pros-banner">
      <div className="pros-banner__media">
        <img src={prosilodImg} alt="Prosilod 8 mg (Silodosina)" />
      </div>

      <div className="pros-banner__body">
        <p className="pros-banner__title">Prosilod 8 mg</p>
        <p className="pros-banner__subtitle">Silodosina</p>

        <ul className="pros-banner__list">
          <li>Alfabloqueante selectivo.</li>
          <li>Manejo de los síntomas urinarios (LUTS) asociados a HBP.</li>
        </ul>

        <p className="pros-banner__legal">
          Medicamento de prescripción. Consulte la ficha técnica antes de
          indicar.
        </p>
      </div>
    </div>
  );
}
