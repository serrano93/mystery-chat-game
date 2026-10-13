const ALLOWED_NAME_CHARS = /[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\s'’-]/g;
const MAX_NAME_LENGTH = 24;

/**
 * Deja el nombre listo para usar, sin valor de reserva. Devuelve cadena vacía
 * si lo escrito no contiene ningún nombre válido, para que quien valide pueda
 * distinguir "no has escrito nada" de "te llamas Detective".
 */
export function cleanPlayerName(raw: string): string {
  const name = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(ALLOWED_NAME_CHARS, '')
    .trim();

  return name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH).trim() : name;
}

export function sanitizePlayerName(raw: string): string {
  const name = cleanPlayerName(raw) || 'Detective';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function personalize(text: string, playerName: string): string {
  return text.replace(/\{playerName\}/g, playerName).replace(/\{nombre\}/g, playerName);
}
