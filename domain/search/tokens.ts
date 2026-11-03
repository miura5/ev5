// Query and passage tokens, ported from ev4 core/library.mjs (libStem, libTokens) and core/evcore.mjs (norm, STOP).
const STOP = new Set(
  'a an and are as at be by for from how in is it of on or the to what when which why with vs versus can t not its their this that'.split(
    ' ',
  ),
);

const SUFFIXES = [
  'ations', 'ation', 'ated', 'ates', 'ate', 'ments', 'ment', 'ings', 'ing', 'ies', 'ied', 'ness', 'ally', 'ly', 'ed',
  'es', 's', 'y', 'ic', 'ia', 'al', 'e',
]; // prettier-ignore

/** Lower-case words separated by single spaces; anything but a-z and 0-9 is a break. */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Light stemming: one common suffix off (the stem keeps 4+ letters), then the first 7 letters. */
function stem(word: string): string {
  let w = word;
  if (w.length >= 5 && !/(ss|us|is)$/.test(w)) {
    for (const s of SUFFIXES) {
      if (w.endsWith(s) && w.length - s.length >= 4) {
        w = w.slice(0, -s.length);
        break;
      }
    }
  }
  return w.slice(0, 7);
}

const words = (s: string): string[] =>
  normalize(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Stemmed search words, in order, without stop words and one-letter words. */
export const tokenize = (s: string): string[] => words(s).map(stem);

/** The `%word%` patterns for a SQL `LIKE` over docs: one per distinct query word (words are a-z and 0-9 only, so nothing needs escaping). */
export const likePatterns = (query: string): string[] => [...new Set(words(query))].map((w) => `%${w}%`);

/** The match a `LIKE` over the patterns makes, case-insensitive: the text holds at least one query word. */
export function likeMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  return words(query).some((w) => t.includes(w));
}
