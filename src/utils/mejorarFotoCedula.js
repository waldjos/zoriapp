/**
 * Segunda lectura local de la zona superior izquierda de la cédula.
 * Usa el canal rojo para suprimir el fondo de seguridad amarillo.
 * Las imágenes generadas viven exclusivamente en memoria y nunca se guardan.
 */

function soloDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function localizarPalabra(palabras, valor) {
  const digitos = soloDigitos(valor);
  if (!digitos || !Array.isArray(palabras)) return null;
  return palabras.find((item) => {
    if (!item?.bbox) return false;
    const candidato = soloDigitos(item.text);
    return candidato.length >= 6 && (candidato === digitos || candidato.includes(digitos));
  }) || null;
}

function encontrarRegion(palabras, documento, nacimiento, width, height) {
  const identidad = localizarPalabra(palabras, documento);
  const fecha = localizarPalabra(palabras, nacimiento);
  if (!identidad?.bbox || !fecha?.bbox) return null;

  // En la cédula venezolana, APELLIDOS y NOMBRES están entre cédula y nacimiento,
  // hacia la izquierda del documento. No recortar fotos ni otros campos de interés.
  const separacion = fecha.bbox.y0 - identidad.bbox.y1;
  if (separacion < height * 0.035 || separacion > height * 0.46) return null;
  const minX = Math.min(identidad.bbox.x0, fecha.bbox.x0);
  const maxX = Math.max(identidad.bbox.x1, fecha.bbox.x1);
  const x = Math.max(0, Math.round(minX - width * 0.19));
  const right = Math.min(width, Math.round(maxX + width * 0.18));
  const y = Math.max(0, Math.round(identidad.bbox.y1 + height * 0.005));
  const bottom = Math.min(height, Math.round(fecha.bbox.y0 - height * 0.006));
  if (right - x < 100 || bottom - y < 40) return null;
  return { x, y, width: right - x, height: bottom - y };
}

async function crearLienzo(foto) {
  const img = await createImageBitmap(foto);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  img.close();
  return canvas;
}

function enfatizarTexto(canvas, region = null) {
  const origen = region || { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const escala = Math.min(2, Math.max(1, 1600 / Math.max(origen.width, origen.height)));
  const final = document.createElement("canvas");
  final.width = Math.round(origen.width * escala);
  final.height = Math.round(origen.height * escala);
  const ctx = final.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, origen.x, origen.y, origen.width, origen.height,
    0, 0, final.width, final.height);
  const datos = ctx.getImageData(0, 0, final.width, final.height);
  const pixels = datos.data;

  // Los trazos negros/azules de las letras conservan R bajo;
  // la marca de agua amarilla mantiene R alto y se aclara.
  for (let i = 0; i < pixels.length; i += 4) {
    const rojo = pixels[i];
    const verde = pixels[i + 1];
    const valor = Math.min(255, Math.max(0,
      (rojo * 0.86 + verde * 0.14 - 105) * 2.2 + 105));
    pixels[i] = valor;
    pixels[i + 1] = valor;
    pixels[i + 2] = valor;
  }
  ctx.putImageData(datos, 0, 0);
  return final;
}

function aBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("No se pudo procesar la fotografía.")),
    "image/png"
  ));
}

export async function prepararLecturasAdicionales(foto, palabras, documento, nacimiento) {
  if (typeof createImageBitmap !== "function") return [];
  let original;
  try {
    original = await crearLienzo(foto);
    const region = encontrarRegion(palabras, documento, nacimiento,
      original.width, original.height);
    const candidatos = [];
    if (region) candidatos.push(await aBlob(enfatizarTexto(original, region)));
    candidatos.push(await aBlob(enfatizarTexto(original)));
    return candidatos;
  } catch {
    return []; // Si el dispositivo tiene poca memoria, no interrumpir la primera lectura.
  } finally {
    if (original) { original.width = 0; original.height = 0; }
  }
}
