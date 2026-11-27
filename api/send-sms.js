// Deshabilitado hasta disponer de autorización institucional en servidor.
export default function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  return res.status(503).json({error:"Mensajería temporalmente deshabilitada por seguridad."});
}
