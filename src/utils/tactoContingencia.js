export const tactoInicial=()=>({tamanio:"",fibroelastica:false,aumentadaConsistencia:false,petrea:false,bordes:"",nodulos:"",ladoNodulo:"",planosClivaje:""});
export function validarTacto(t,uid){
 if(!uid||!["I","II","III"].includes(t.tamanio)||!["regulares","irregulares"].includes(t.bordes)||!["si","no"].includes(t.nodulos)||!["si","no"].includes(t.planosClivaje)||!["fibroelastica","aumentadaConsistencia","petrea"].some(k=>t[k]===true)||t.nodulos==="si"&&!["derecho","izquierdo","bilateral"].includes(t.ladoNodulo))throw Error("Completa todos los hallazgos de la evaluación.");
 return {tamanio:t.tamanio,fibroelastica:t.fibroelastica===true,aumentadaConsistencia:t.aumentadaConsistencia===true,petrea:t.petrea===true,bordes:t.bordes,nodulos:t.nodulos,ladoNodulo:t.nodulos==="si"?t.ladoNodulo:"",planosClivaje:t.planosClivaje,medicoId:uid};
}
