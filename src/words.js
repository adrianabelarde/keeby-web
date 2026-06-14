// 200 common English words (3-8 letters, lowercase, no apostrophes).
// Frequency-ranked selection derived from common-word corpora — designed for
// a 15-second typing test where even 200+ WPM typists stay inside a 60-word slice.

export const COMMON_WORDS = [
  'the', 'and', 'you', 'that', 'for', 'with', 'not', 'but', 'what', 'some',
  'can', 'out', 'are', 'all', 'there', 'when', 'your', 'how', 'said', 'each',
  'which', 'their', 'time', 'will', 'way', 'about', 'many', 'then', 'them',
  'would', 'like', 'these', 'her', 'long', 'make', 'thing', 'see', 'him',
  'two', 'has', 'look', 'more', 'day', 'could', 'come', 'did', 'number',
  'sound', 'most', 'people', 'over', 'know', 'water', 'than', 'call',
  'first', 'who', 'may', 'down', 'side', 'been', 'now', 'find', 'any',
  'new', 'work', 'part', 'take', 'get', 'place', 'made', 'live', 'where',
  'after', 'back', 'little', 'only', 'round', 'man', 'year', 'came', 'show',
  'every', 'good', 'give', 'under', 'name', 'very', 'through', 'just',
  'form', 'much', 'great', 'think', 'help', 'low', 'line', 'before', 'turn',
  'cause', 'same', 'mean', 'differ', 'move', 'right', 'old', 'too', 'does',
  'tell', 'sentence', 'set', 'three', 'want', 'air', 'well', 'also', 'play',
  'small', 'end', 'put', 'home', 'read', 'hand', 'large', 'spell', 'add',
  'even', 'land', 'here', 'must', 'big', 'high', 'such', 'follow', 'act',
  'why', 'ask', 'men', 'change', 'went', 'light', 'kind', 'off', 'need',
  'house', 'picture', 'try', 'again', 'animal', 'point', 'mother', 'world',
  'near', 'build', 'self', 'earth', 'father', 'head', 'stand', 'own',
  'page', 'should', 'country', 'found', 'answer', 'school', 'grow',
  'study', 'still', 'learn', 'plant', 'cover', 'food', 'sun', 'four',
  'between', 'state', 'keep', 'eye', 'never', 'last', 'let', 'thought',
  'city', 'tree', 'cross', 'farm', 'hard', 'start', 'might', 'story',
  'saw', 'far', 'sea', 'draw', 'left', 'late', 'run', 'while', 'press',
  'close', 'night', 'real', 'life', 'few', 'north', 'open',
]

export function pickWords(n = 60) {
  const pool = COMMON_WORDS.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const slice = pool.slice(0, n)
  // Two "keeby" slots — one on the first line, one around the third line —
  // so the shimmer reveal hits multiple times during a 15s test. Positions
  // are randomised within each line's band so the placement isn't predictable.
  //
  // Word widths vary but a line typically holds ~10-12 words in the default
  // viewport. Band 1 covers the first line's early-middle; band 2 targets
  // the start of the third line.
  const firstLineIdx = 1 + Math.floor(Math.random() * 8)       // 1..8
  const thirdLineIdx = 22 + Math.floor(Math.random() * 8)      // 22..29
  slice[firstLineIdx] = 'keeby'
  slice[thirdLineIdx] = 'keeby'
  return slice
}
