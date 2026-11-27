// Función pura: no contiene identificadores reales.
export function normalizarUids(texto, propio){
 const ids=[...new Set(texto.trim().split(/\s+/).filter(Boolean))];
 if(!ids.length || ids.length>50 || ids.some(id=>!/^[A-Za-z0-9_-]{1,128}$/.test(id)||id===propio))throw new Error("Introduce entre 1 y 50 UID válidos, sin incluir tu propia cuenta.");
 return ids;
}
