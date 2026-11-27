// La interfaz no reemplaza las reglas de Firestore. No confiar en datos de caché.
export function destinoInstitucional(p){
 if(p?.activo!==true)return "denegado";
 if(p.rol==="superadmin")return "admin";
 if(p.rol!=="medico")return "denegado";
 if(p.sedeId==="periferico_catia")return "catia";
 if(p.sedeId==="domingo_luciani")return "luciani";
 return "denegado";
}
