const MIN_SENTENCES = 3;
const MAX_SENTENCES = 5;
const MAX_WORDS_PER_SENTENCE = 16;

const FILLER_SENTENCES = [
  'Podrobnosti závisia od konkrétnej situácie.',
  'Presný ďalší krok s Vami radi prejdeme na konzultácii.',
  'Ozvať sa môžete e-mailom alebo telefonicky.'
];

function splitSentences(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('sk', { granularity: 'sentence' });
    return Array.from(segmenter.segment(text), item => item.segment.trim()).filter(Boolean);
  }

  return text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(part => part.trim()).filter(Boolean) || [];
}

function wordCount(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function capitalise(text) {
  return text.replace(/^([„"'([{]*)(\p{L})/u, (_, prefix, letter) =>
    prefix + letter.toLocaleUpperCase('sk')
  );
}

function finishSentence(text, punctuation = '.') {
  const clean = text
    .trim()
    .replace(/^[,;:—–-]+\s*/u, '')
    .replace(/[\s,;:—–-]+$/u, '');

  if (!clean) return '';
  if (/[.!?]["'”’)]*$/u.test(clean)) return capitalise(clean);
  return capitalise(clean) + punctuation;
}

function splitLongSentence(sentence) {
  if (wordCount(sentence) <= MAX_WORDS_PER_SENTENCE) return [finishSentence(sentence)];

  const finalPunctuation = sentence.match(/[!?](?:["'”’)]*)$/u)?.[0]?.[0] || '.';
  let words = sentence.replace(/[.!?]+["'”’)]*$/u, '').trim().split(/\s+/u).filter(Boolean);
  const pieces = [];

  while (words.length > MAX_WORDS_PER_SENTENCE) {
    let cut = -1;

    for (let i = 8; i <= MAX_WORDS_PER_SENTENCE && i < words.length; i += 1) {
      const nextWord = words[i].replace(/^[„"'([{]+/u, '');
      const startsDependentClause = /^(?:aby|keď|kým|pretože|pričom|či|ktorý|ktorá|ktoré|ktorí)$/iu.test(nextWord);
      const previousHasBreak = /[,;:—–-]$/u.test(words[i - 1]) && !startsDependentClause;
      const nextStartsNewThought = /^(?:ale|avšak|no|potom|preto|zároveň)$/iu.test(nextWord);
      if ((previousHasBreak || nextStartsNewThought) && words.length - i >= 4) cut = i;
    }

    if (cut < 0) cut = MAX_WORDS_PER_SENTENCE;
    pieces.push(finishSentence(words.slice(0, cut).join(' ')));
    words = words.slice(cut);

    if (/^(?:a|ale|avšak|no|pričom)$/iu.test(words[0]?.replace(/^[„"'([{]+/u, ''))) {
      words = words.slice(1);
    }
  }

  if (words.length) pieces.push(finishSentence(words.join(' '), finalPunctuation));
  return pieces.filter(Boolean);
}

function formatReply(rawReply) {
  const text = String(rawReply || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';

  const sentences = splitSentences(text)
    .flatMap(splitLongSentence)
    .filter(Boolean)
    .slice(0, MAX_SENTENCES);

  for (const filler of FILLER_SENTENCES) {
    if (sentences.length >= MIN_SENTENCES) break;
    if (!sentences.includes(filler)) sentences.push(filler);
  }

  return sentences.slice(0, MAX_SENTENCES).join('\n\n');
}

module.exports = {
  formatReply,
  splitSentences,
  wordCount,
  MIN_SENTENCES,
  MAX_SENTENCES,
  MAX_WORDS_PER_SENTENCE
};
