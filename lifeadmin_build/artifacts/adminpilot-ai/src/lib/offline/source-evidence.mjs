const sourceDate = /\b(?:(?:(?:checked|verified|as of|accessed)\s*(?:on\s*)?)(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})|(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}))\b/i;

/** A linked, dated reference is evidence supplied by the AI, not verification by HomeAdmin. */
export function hasDatedSourceReference(alternatives) {
  if (typeof alternatives !== "string") return false;
  const hasWebLink = /https:\/\/[^\s)\]]+/i.test(alternatives);
  return hasWebLink && sourceDate.test(alternatives);
}
