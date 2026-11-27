#!/usr/bin/env python3
# Recuperación de Catia exclusivamente. Sin archivos de datos ni registros clínicos en stdout.
import sys, json, subprocess, urllib.request, urllib.parse, urllib.error, hashlib, datetime, re, unicodedata, math
PROJECT="zoriapp-23b52"
SEDE="periferico_catia"
JORNADA="periferico-catia-2026"
FS=f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sedes/{SEDE}/pacientes"
RT=f"https://{PROJECT}-default-rtdb.firebaseio.com/contingencia"
TOKEN=None
class Stop(Exception): pass
def req(url, method="GET", data=None, headers=None):
    h={"Authorization":"Bearer "+TOKEN, "Accept":"application/json"}
    if data is not None: h["Content-Type"]="application/json"
    h.update(headers or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(data,ensure_ascii=False,allow_nan=False).encode() if data is not None else None, headers=h, method=method), timeout=30) as r:
            return json.load(r),r.headers
    except urllib.error.HTTPError as e:
        if e.code==412: return None,None
        raise Stop(f"{method}: HTTP {e.code}. "+("Firestore" if url.startswith(FS) else "Realtime Database")) from None
    except Exception as e: raise Stop("Error de conexión: "+type(e).__name__) from None
def decode(v):
    for k in ("stringValue","booleanValue","doubleValue","timestampValue"):
        if k in v:return v[k]
    if "integerValue" in v:return int(v["integerValue"])
    if "nullValue" in v:return None
    if "mapValue" in v:return {k:decode(x) for k,x in v["mapValue"].get("fields",{}).items()}
    if "arrayValue" in v:return [decode(x) for x in v["arrayValue"].get("values",[])]
    raise ValueError("Tipo no previsto")
def ms(x):
    if not isinstance(x,str):raise ValueError("Falta fecha original")
    return int(datetime.datetime.fromisoformat(x.replace("Z","+00:00")).timestamp()*1000)
def txt(v):return v if isinstance(v,str) else ""
def norm(v):return " ".join(unicodedata.normalize("NFKC",txt(v)).casefold().split())
def num(v):
    if v is None or v=="":return ""
    n=float(str(v).replace(",","."))
    if not math.isfinite(n) or n<0:raise ValueError("PSA inválido")
    return n
def convert(doc):
    p={k:decode(v) for k,v in doc.get("fields",{}).items()}
    if p.get("sedeId")!=SEDE or p.get("jornadaId")!=JORNADA or p.get("jornadaAnio")!=2026:raise ValueError("Sede o jornada no coincide")
    d=txt(p.get("tipoDocumento"))+"-"+str(p.get("cedula",""))
    if not re.fullmatch(r"[VE]-[0-9]{5,9}",d) or doc["name"].split("/")[-1]!=JORNADA+"-"+d:raise ValueError("Documento no coincide")
    f={k:txt(p.get(k)) for k in ("tipoDocumento","nombreCompleto","telefono","email","fechaNacimiento","localidad","notas","creadoPor")}
    f.update(cedula=d[2:],sedeId=SEDE,jornadaAnio=2026,origen="contingencia",createdAt=ms(p.get("createdAt") or doc["createTime"]),edad=p.get("edad"))
    if not f["nombreCompleto"].strip() or not f["creadoPor"] or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",f["fechaNacimiento"]) or type(f["edad"]) is not int or not 0<=f["edad"]<=150:raise ValueError("Ficha incompleta")
    datetime.date.fromisoformat(f["fechaNacimiento"])
    anexos=[]
    pendientes=0
    if p.get("tacto") is not None:
        try:
            t=p["tacto"]
            keys=("tamanio","fibroelastica","aumentadaConsistencia","petrea","bordes","nodulos","ladoNodulo","planosClivaje","medicoId")
            v={k:t[k] for k in keys}
            v["actualizadoEn"]=ms(t["actualizadoEn"])
            if not v["medicoId"] or not all(type(v[k]) is bool for k in keys[1:4]):raise ValueError("Tacto incompleto")
            if "comentarios" in t and isinstance(t["comentarios"],str):v["comentarios"]=t["comentarios"]
            anexos.append(("tactos",v))
        except (KeyError,TypeError,ValueError):pendientes+=1
    if p.get("psaTotal") not in (None,"") or p.get("psaLibre") not in (None,""):
        try:
            a,b=num(p.get("psaTotal")),num(p.get("psaLibre"))
            if a=="" or b!="" and b>a or not p.get("psaRegistradoPor"):raise ValueError("PSA incompleto")
            anexos.append(("psa",{"total":a,"libre":b,"medicoId":p["psaRegistradoPor"],"actualizadoEn":ms(p["psaActualizadoEn"])}))
        except (KeyError,TypeError,ValueError):pendientes+=1
    if p.get("entregaResultados")=="entregado":
        try:
            if not p.get("entregaRegistradaPor"):raise ValueError("Autor no disponible")
            anexos.append(("entregas",{"estado":"entregado","medicoId":p["entregaRegistradaPor"],"actualizadoEn":ms(p["entregaResultadosAt"])}))
        except (KeyError,TypeError,ValueError):pendientes+=1
    return d,f,anexos,pendientes
def url(t,d,k=None):
    assert t in ("registros","tactos","psa","entregas") and re.fullmatch(r"[VE]-[0-9]{5,9}",d)
    return f"{RT}/{t}/{SEDE}/{d}"+("/"+k if k else "")+".json"
def read_cond(u):return req(u,headers={"X-Firebase-ETag":"true"})
def add_if_absent(u,v):
    old,h=read_cond(u)
    if old is not None:return "existente" if old==v else "conflicto"
    if not h or not h.get("ETag"):raise Stop("Falta ETag: no se escribió.")
    _,h2=req(u,"PUT",v,{"if-match":h["ETag"]})
    return "copiado" if h2 is not None else "concurrencia"
def identity(a,b):
    return a.get("sedeId")==SEDE and a.get("jornadaAnio")==2026 and a.get("cedula")==b["cedula"] and a.get("tipoDocumento")==b["tipoDocumento"] and a.get("fechaNacimiento")==b["fechaNacimiento"] and norm(a.get("nombreCompleto"))==norm(b["nombreCompleto"])
def main():
    global TOKEN
    TOKEN=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
    if not TOKEN:raise Stop("No hay sesión administrativa.")
    docs=[];page=None;seen=set()
    while True:
        params={"pageSize":100}
        if page:params["pageToken"]=page
        data,_=req(FS+"?"+urllib.parse.urlencode(params),headers={"x-goog-user-project":PROJECT})
        docs.extend(data.get("documents",[]))
        page=data.get("nextPageToken")
        if not page:break
        if page in seen:raise Stop("Paginación repetida. No se escribió nada.")
        seen.add(page)
    print("Fichas originales de Catia:",len(docs),flush=True)
    preparados=[];omitidas=0;pendientes=0
    for doc in docs:
        try:
            d,f,anexos,n=convert(doc);preparados.append((d,f,anexos));pendientes+=n
        except (KeyError,TypeError,ValueError):omitidas+=1
    print("Fichas válidas:",len(preparados),"Fichas a revisar:",omitidas,"Anexos a revisar:",pendientes,flush=True)
    if not preparados:
        print("No se escribió nada.");return
    if "--aplicar" not in sys.argv:
        print("Solo diagnóstico; no se escribió nada.");return
    nuevos=existentes=conflictos=tactos=psas=entregas=anexos_conf=0
    for d,f,anexos in preparados:
        u=url("registros",d)
        old,h=read_cond(u)
        if old is None:
            if not h or not h.get("ETag"):raise Stop("Falta ETag.")
            _,h2=req(u,"PUT",f,{"if-match":h["ETag"]})
            if h2 is not None:nuevos+=1;old=f
            else:old,_=read_cond(u)
        else:existentes+=1
        if not isinstance(old,dict) or not identity(old,f):conflictos+=1;continue
        # No alterar fichas que ya existían. Solo completar anexos con su identidad original.
        for t,v in anexos:
            # La clave estable evita duplicar una evaluación si se repite el comando.
            k=None if t=="entregas" else "fs_"+hashlib.sha256(json.dumps(v,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:32]
            estado=add_if_absent(url(t,d,k),v)
            if estado in ("copiado","existente"):
                if t=="tactos":tactos+=1
                elif t=="psa":psas+=1
                else:entregas+=1
            else:anexos_conf+=1
    final,_=req(f"{RT}/registros/{SEDE}.json?shallow=true")
    print("Fichas incorporadas:",nuevos,"Ya existentes:",existentes,"Conflictos de identidad:",conflictos)
    print("Tactos recuperados o ya presentes:",tactos,"PSA:",psas,"Entregas:",entregas,"Anexos en conflicto:",anexos_conf)
    print("Total actual de fichas en Catia RTDB:",len(final or {}))
    print("Luciani: ninguna operación. Firestore: solo lectura. No se eliminaron registros.")
if __name__=="__main__":
    try:main()
    except Stop as e:print("RECUPERACIÓN INTERRUMPIDA:",e);sys.exit(1)
    except Exception as e:print("RECUPERACIÓN INTERRUMPIDA:",type(e).__name__);sys.exit(1)
