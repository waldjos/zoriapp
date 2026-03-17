// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png"; // ajusta el nombre si tu logo se llama distinto

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/"); // te lleva al Home con los 5 botones
    } catch (err) {
      console.error(err);
      setError("Correo o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Columna izquierda: branding y beneficios */}
        <div className="login-left">
          <div className="login-logo-row">
            <img src={logo} alt="Zoriapp" className="login-logo" />
            <span className="login-logo-text">Zoriapp</span>
          </div>

          <h1 className="login-title">Ingreso a Zoriapp</h1>
          <p className="login-subtitle">
            Plataforma médica para jornadas de urología, diseñada para que
            registres, evalúes y valides resultados en minutos.
          </p>

          <div className="login-badges">
            <span className="login-badge">✅ Registro rápido de pacientes</span>
            <span className="login-badge">✅ Evaluación táctica guiada</span>
            <span className="login-badge">✅ PDFs de laboratorio centralizados</span>
            <span className="login-badge">✅ Dashboard de resultados</span>
          </div>

          <p className="login-footer-text">
            Acceso exclusivo para médicos autorizados. Tus datos y los del
            paciente se almacenan de forma segura en la nube.
          </p>
        </div>

        {/* Columna derecha: formulario */}
        <div className="login-right">
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-label">
              Correo electrónico
              <input
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="medico@centro.com"
                required
              />
            </label>

            <label className="login-label">
              Contraseña
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="login-button"
              disabled={submitting}
            >
              {submitting ? "Ingresando..." : "Ingresar"}
            </button>

            <p className="login-hint">
              Si tienes problemas para ingresar, contacta al coordinador de la
              jornada para validar tu usuario.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
