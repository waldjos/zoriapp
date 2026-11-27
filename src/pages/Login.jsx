import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PatrocinanteZoriak } from "../components/IdentidadJornada";
import ZoriIcon from "../components/ZoriIcon";

const FUNCIONES = [
  ["registrar-paciente", "Registro rápido de pacientes"],
  ["evaluacion", "Evaluación clínica"],
  ["laboratorio", "Resultados de laboratorio"],
  ["sincronizar", "Sincronización de tu información"],
];

export default function Login({destino="/"}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(destino);
    } catch {
      setError("No fue posible ingresar. Comprueba tus credenciales o comunícate con el coordinador.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page zori-design-login">
      <div className="zori-design-login-wrap">
        <header className="zori-design-login-header" aria-label="Identidad y patrocinio">
          <img src="/branding/zoriapp-2026.svg"
            alt="ZoriApp · Gestión de jornadas médicas" />
          <PatrocinanteZoriak compact />
        </header>
        <section className="zori-design-login-card">
          <div className="zori-design-login-intro">
            <div className="zori-design-login-emblem">
              <ZoriIcon name="evaluacion" size={69} strokeWidth={1.65}/>
              <ZoriIcon name="urologia" size={38} strokeWidth={1.65} className="zori-design-login-kidney"/>
            </div>
            <div>
              <h1>Ingreso a ZoriApp</h1>
              <p>Gestiona jornadas médicas y la línea de urología de forma simple y segura.</p>
            </div>
          </div>
          <form className="zori-design-login-form" onSubmit={handleSubmit}>
            <div className="zori-design-login-field">
              <ZoriIcon name="correo" size={27}/>
              <input aria-label="Correo electrónico" type="email" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="username"
                inputMode="email" placeholder="Correo electrónico" required />
            </div>
            <div className="zori-design-login-field">
              <ZoriIcon name="seguridad" size={27}/>
              <input aria-label="Contraseña" type={mostrarClave ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="Contraseña" required/>
              <button type="button" className="zori-design-show-password"
                aria-label={mostrarClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={mostrarClave} onClick={() => setMostrarClave(v=>!v)}>
                {mostrarClave ? "Ocultar" : "Ver"}
              </button>
            </div>
            {error && <p role="alert" className="login-error">{error}</p>}
            <button className="zori-design-login-submit" type="submit" disabled={submitting}>
              {submitting ? "Ingresando..." : "Ingresar"}
              <ZoriIcon name="siguiente" size={26}/>
            </button>
          </form>
          <div className="zori-design-login-benefits">
            {FUNCIONES.map(([icono, texto])=>(
              <div key={texto}>
                <span><ZoriIcon name={icono} size={26}/></span>
                <strong>{texto}</strong>
              </div>
            ))}
          </div>
          <p className="zori-design-login-disclaimer">
            Acceso exclusivo para médicos autorizados. Los registros pueden guardarse temporalmente
            en este teléfono y sincronizarse al recuperar conexión.
          </p>
        </section>
      </div>
    </div>
  );
}
