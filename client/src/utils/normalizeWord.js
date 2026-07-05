export function normalizeWord(word) {
  if (!word) return '';
  return word.trim().toLocaleLowerCase('de');
}