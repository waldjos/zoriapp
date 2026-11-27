// Retirado: el OCR de cédula se ejecuta en el dispositivo.
export default function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  return res.status(410).json({error:"Servicio OCR externo deshabilitado. Utiliza el lector local."});
}
