/**
 * Captura normalizada para el Registro Express de ZoriApp.
 * Las funciones son puras y no acceden a Firebase ni a datos de pacientes.
 */

export function nombrePropio(valor) {
  if (valor == null) return "";
  const limpio = String(valor).trim().replace(/\s+/g, " ").toLocaleLowerCase("es-VE");
  return limpio.replace(/(^|[\s\-'’])(\p{L})/gu, (_, separador, letra) =>
    separador + letra.toLocaleUpperCase("es-VE")
  );
}

export function cedulaVE(valor, tipoSeleccionado = "V") {
  const sinSeparadores = String(valor ?? "").trim().toUpperCase().replace(/[.\s\-]/g, "");
  const coincidencia = sinSeparadores.match(/^([VE])?(\d+)$/);
  if (!coincidencia) throw new Error("La cédula solo admite números y el prefijo V o E.");
  const tipoDocumento = coincidencia[1] || tipoSeleccionado;
  if (!["V", "E"].includes(tipoDocumento)) {
    throw new Error("Selecciona V (venezolano) o E (extranjero).");
  }
  const cedula = coincidencia[2];
  if (!/^\d{5,9}$/.test(cedula)) {
    throw new Error("La cédula debe contener entre 5 y 9 dígitos.");
  }
  return { cedula, tipoDocumento, etiqueta: `${tipoDocumento}-${cedula}` };
}

export function telefonoE164VE(valor) {
  const entrada = String(valor ?? "").trim();
  if (!entrada) return "";
  // Solo se eliminan separadores de presentación; letras y símbolos inesperados generan error.
  const compacto = entrada.replace(/[\s().\-]/g, "");
  if (!/^\+?\d+$/.test(compacto)) {
    throw new Error("El teléfono contiene caracteres no permitidos.");
  }
  let digitos = compacto.replace(/^\+/, "");
  if (digitos.startsWith("0058")) digitos = digitos.slice(4);
  else if (digitos.startsWith("58")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  // El móvil venezolano incluye 10 dígitos tras +58; no se truncan números incompletos.
  if (!/^4\d{9}$/.test(digitos)) {
    throw new Error("Introduce un celular venezolano completo: 04XX-XXXXXXX.");
  }
  return `+58${digitos}`;
}

export function correoNormalizado(valor) {
  const correo = String(valor ?? "").trim().toLowerCase();
  if (!correo) return "";
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(correo)) {
    throw new Error("El correo electrónico no tiene un formato válido.");
  }
  return correo;
}

export function fechaNacimientoISO(valor, hoy = new Date()) {
  const entrada = String(valor ?? "").trim();
  if (!entrada) return "";
  let anio, mes, dia;
  let match = entrada.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (match) {
    [, anio, mes, dia] = match;
  } else {
    match = entrada.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (match) [, dia, mes, anio] = match;
    else if (/^\d{8}$/.test(entrada)) {
      dia = entrada.slice(0, 2);
      mes = entrada.slice(2, 4);
      anio = entrada.slice(4);
    } else {
      throw new Error("Escribe la fecha de nacimiento como DD/MM/AAAA.");
    }
  }

  const y = Number(anio), m = Number(mes), d = Number(dia);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (y < 1880 || fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 ||
      fecha.getUTCDate() !== d) {
    throw new Error("La fecha de nacimiento no existe o está fuera de rango.");
  }
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (iso > hoyISO) throw new Error("La fecha de nacimiento no puede ser futura.");
  return iso;
}

export function fechaParaFormulario(valor) {
  if (!valor) return "";
  const entrada = String(valor).trim();
  const iso = entrada.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return entrada;
}

export function mascaraFechaRapida(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0,2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0,2)}/${digitos.slice(2,4)}/${digitos.slice(4)}`;
}

export function edadDesdeFecha(iso, hoy = new Date()) {
  if (!iso) return null;
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad;
}
