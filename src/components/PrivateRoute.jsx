import {Navigate} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
export default function PrivateRoute({children,roles=["admin_sede","medico"]}){
 const {user,perfil}=useAuth();
 if(!user)return <Navigate to="/login" replace/>;
 if(!perfil)return null;
 if(!roles.includes(perfil.rol))return <Navigate to={perfil.rol==="superadmin"?"/superadmin":"/registro"} replace/>;
 return children;
}
