export const NARROW_TITLE_MAX = 28;

export function shortenTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength).trimEnd()}…`;
}
