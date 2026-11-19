import React from "react";

/**
 * Iconos oficiales de interfaz de ZoriApp 2026.
 * Trazados importados del kit SVG aprobado: viewBox 24, trazo 1.9 y puntas redondas.
 * No se usan para reconstruir logotipos institucionales o farmacéuticos.
 */
const iconos = {
  "inicio": [["path",{d:"m3 10 9-7 9 7"}],["path",{d:"M5 9v12h14V9"}],["path",{d:"M9 21v-7h6v7"}]],
  "registrar-paciente": [["circle",{cx:9,cy:8,r:3}],["path",{d:"M3.5 20v-2a5.5 5.5 0 0 1 11 0v2"}],["path",{d:"M19 10v8M15 14h8"}]],
  "buscar": [["circle",{cx:10.5,cy:10.5,r:6.5}],["path",{d:"m16 16 5 5"}]],
  "jornada-2026": [["rect",{x:3,y:5,width:18,height:16,rx:2}],["path",{d:"M7 3v4M17 3v4M3 10h18"}],["path",{d:"m8.5 16 2.5 2.5 4.5-5"}]],
  "historico-2025": [["path",{d:"M3 6h18v15H3z"}],["path",{d:"M3 6V3h18v3M7 11h10M7 15h7M7 19h3"}]],
  "urologia": [["path",{d:"M7 3c-2 0-4 3-4 6v4c0 3 2 5 4 5 3 0 3-3 3-5V9C10 5 9 3 7 3ZM17 3c2 0 4 3 4 6v4c0 3-2 5-4 5-3 0-3-3-3-5V9c0-4 1-6 3-6Z"}],["path",{d:"M10 15c0 2 1 3 2 3s2-1 2-3M12 18v3"}]],
  "evaluacion": [["rect",{x:5,y:4,width:14,height:18,rx:2}],["path",{d:"M9 4V2h6v2M8 10h2M12 10h4M8 15l2 2 4-4"}]],
  "laboratorio": [["path",{d:"M9 3h6M10 3v7l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"}],["path",{d:"M7 17h10"}]],
  "mas": [["circle",{cx:4,cy:12,r:1.4}],["circle",{cx:12,cy:12,r:1.4}],["circle",{cx:20,cy:12,r:1.4}]],
  "pacientes": [["circle",{cx:9,cy:8,r:3}],["path",{d:"M2 20v-2a7 7 0 0 1 14 0v2"}],["path",{d:"M16 5a3 3 0 0 1 0 6"}],["path",{d:"M19 14a5 5 0 0 1 3 5v1"}]],
  "siguiente": [["path",{d:"m10 6 6 6-6 6"}]],
  "correo": [["rect",{x:2,y:5,width:20,height:14,rx:2}],["path",{d:"m3 7 9 7 9-7"}]],
  "seguridad": [["path",{d:"m12 2 8 3v7c0 5-4 8-8 10-4-2-8-5-8-10V5Z"}],["path",{d:"m8 12 3 3 5-6"}]],
  "sincronizar": [["path",{d:"M20 7a8 8 0 0 0-14-3L3 7"}],["path",{d:"M3 2v5h5M4 17a8 8 0 0 0 14 3l3-3"}],["path",{d:"M21 22v-5h-5"}]],
  "ficha-paciente": [["rect",{x:5,y:3,width:14,height:19,rx:2}],["circle",{cx:12,cy:9,r:2}],["path",{d:"M8 16c0-3 8-3 8 0M8 19h8"}]],
  "cerrar-sesion": [["path",{d:"M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"}],["path",{d:"M11 12h10m-4-4 4 4-4 4"}]],
};

export default function ZoriIcon({name, size=24, color="currentColor", className="", strokeWidth=1.9, ...rest}) {
  const elementos = iconos[name] || iconos["evaluacion"];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {elementos.map(([tag,props],i)=>React.createElement(tag,{...props,key:i}))}
    </svg>
  );
}
