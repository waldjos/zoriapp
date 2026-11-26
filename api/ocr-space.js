// Desactivado en el piloto multisede: no transmitir documentos clínicos a terceros.
export default function handler(_req,res){return res.status(503).json({error:"OCR externo deshabilitado en la prueba multisede."});}
