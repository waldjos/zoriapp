/**
 * La foto puede llegar girada 90° porque el documento se fotografió de costado.
 * Se generan alternativas solo en memoria; no se envían a ningún proveedor.
 */
export async function rotarFotoCedulaLocal(foto, grados) {
  if (typeof createImageBitmap !== "function") return null;
  let imagen;
  try {
    imagen = await createImageBitmap(foto);
    const angulo = grados === 90 ? Math.PI / 2 : -Math.PI / 2;
    const canvas = document.createElement("canvas");
    canvas.width = imagen.height;
    canvas.height = imagen.width;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angulo);
    ctx.drawImage(imagen, -imagen.width / 2, -imagen.height / 2);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Rotación de imagen fallida.")), "image/jpeg", 0.92)
    );
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } catch {
    return null;
  } finally {
    imagen?.close?.();
  }
}
