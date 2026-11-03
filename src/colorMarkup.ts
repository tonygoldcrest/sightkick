// Clone Hero writes names as `<color=#hex>letter` repeated for each character.
// The `#` is an ini comment, so the tag has to be removed before the file is parsed.
export function stripColorMarkup(value: string): string {
  return value
    .replace(/<color\b[^>]*>/gi, '')
    .replace(/<\/color>/gi, '')
    .replace(/<color\b[^>]*$/gi, '');
}
