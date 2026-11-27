import {getDatabase,ref,onValue} from "firebase/database";
import app from "../firebase";
export const dbContingencia=getDatabase(app,"https://zoriapp-23b52-default-rtdb.firebaseio.com");
export function observarMiembroContingencia(uid,cb,error){return onValue(ref(dbContingencia,"contingencia/miembros/"+uid),s=>cb(s.val()),error);}
