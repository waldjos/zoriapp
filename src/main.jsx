// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // o App.css, según lo que uses de estilos

class LimiteArranque extends React.Component {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){if(this.state.error)return <main className="page-container" style={{padding:"24px"}}><h2>ZoriApp</h2><p role="alert">No se pudo abrir esta pantalla. Si estabas registrando una ficha, comprueba su existencia antes de repetir el registro.</p><button type="button" onClick={()=>window.location.reload()}>Volver a cargar</button></main>;return this.props.children;}
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LimiteArranque><App /></LimiteArranque>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .catch(() => console.warn("La aplicación no pudo activar el modo offline."));
  });
}
