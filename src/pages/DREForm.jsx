import { useParams } from "react-router-dom";

export default function DREForm() {
  const { id } = useParams();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Evaluación DRE</h1>
      <p>Paciente: <strong>{id}</strong></p>
      <p>Aquí estará el formulario de tacto rectal (tamaño, bordes, nódulos, etc.).</p>
    </div>
  );
}
