/** UUID v4 criptográfico compatible con Safari anterior a 15.4.
 * Nunca sustituye aleatoriedad segura por Math.random().
 */
export function uuidSeguro(origen = globalThis.crypto) {
  if (typeof origen?.randomUUID === "function") return origen.randomUUID();
  if (typeof origen?.getRandomValues !== "function") {
    throw new Error("Este navegador no dispone de generación criptográfica segura.");
  }
  const bytes = origen.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20)].join("-");
}
