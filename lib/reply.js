const MIN_SENTENCES = 3;
const MAX_SENTENCES = 5;
const MAX_WORDS_PER_SENTENCE = 18;
const MIN_WORDS_PER_SPLIT = 5;

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

function cleanModelFormatting(text) {
  return text
    .replace(/```(?:\w+)?\s*([\s\S]*?)```/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*])\s+/gmu, '')
    .replace(/\*\*|__/gu, '')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,!?]|$)/gu, '$1$2')
    .replace(/(?:\+421\s*|0)?915[\s.-]*775[\s.-]*480/gu, '+421 915 775 480')
    .replace(/(?:\+421\s*|0)?905[\s.-]*617[\s.-]*653/gu, '+421 905 617 653');
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
    let cutBeforeLimit = -1;
    let cutAfterLimit = -1;

    for (let i = MIN_WORDS_PER_SPLIT; i < words.length; i += 1) {
      if (words.length - i < MIN_WORDS_PER_SPLIT) break;
      const nextWord = words[i].replace(/^[„"'([{]+/u, '');
      const startsDependentClause = /^(?:aby|aký|aká|aké|ako|čo|hoci|kde|keď|kým|pretože|pričom|či|že|ktorý|ktorá|ktoré|ktorí|ktorom|ktorej)$/iu.test(nextWord);
      const previousHasBreak = /[,;:—–-]$/u.test(words[i - 1]) && !startsDependentClause;
      const nextStartsNewThought = /^(?:ale|avšak|no|potom|preto|zároveň)$/iu.test(nextWord);
      if (previousHasBreak || nextStartsNewThought) {
        if (i <= MAX_WORDS_PER_SENTENCE) {
          cutBeforeLimit = i;
        } else {
          cutAfterLimit = i;
          break;
        }
      }
    }

    const cut = cutBeforeLimit >= 0 ? cutBeforeLimit : cutAfterLimit;

    // Prirodzený zlom je dôležitejší než tvrdý počet slov. Bez neho by
    // vznikali nezmyselné fragmenty ako „Dokumentácie."
    if (cut < 0) {
      pieces.push(finishSentence(words.join(' '), finalPunctuation));
      words = [];
      break;
    }

    pieces.push(finishSentence(words.slice(0, cut).join(' ')));
    words = words.slice(cut);

    if (/^(?:a|ale|avšak|no|pričom)$/iu.test(words[0]?.replace(/^[„"'([{]+/u, ''))) {
      words = words.slice(1);
    }
  }

  if (words.length) pieces.push(finishSentence(words.join(' '), finalPunctuation));
  return pieces.filter(Boolean);
}

function lowerCaseFirstWord(text) {
  return text.replace(/^([„"'([{]*)(\p{L})/u, (_, prefix, letter) =>
    prefix + letter.toLocaleLowerCase('sk')
  );
}

function mergeOrphanFragments(sentences) {
  const result = [];
  const validShortReplies = /^(?:áno|nie|dobre|ďakujeme|rozumiem|samozrejme|presne|určite)[.!?]?$/iu;

  for (const sentence of sentences) {
    const previous = result[result.length - 1];
    const isOrphan = wordCount(sentence) === 1 && !validShortReplies.test(sentence.trim());
    const previousCanContinue = previous && !/[!?]["'”’)]*$/u.test(previous);

    if (isOrphan && previousCanContinue) {
      const punctuation = sentence.match(/[.!?](?:["'”’)]*)$/u)?.[0]?.[0] || '.';
      const previousBody = previous.replace(/[.]["'”’)]*$/u, '').trim();
      const fragmentBody = sentence.replace(/[.!?]+["'”’)]*$/u, '').trim();
      result[result.length - 1] = finishSentence(
        `${previousBody} ${lowerCaseFirstWord(fragmentBody)}`,
        punctuation
      );
      continue;
    }

    result.push(sentence);
  }

  return result;
}

function formatReply(rawReply) {
  const text = cleanModelFormatting(String(rawReply || ''))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';

  const sentences = mergeOrphanFragments(
    splitSentences(text)
      .flatMap(splitLongSentence)
      .filter(Boolean)
  ).slice(0, MAX_SENTENCES);

  for (const filler of FILLER_SENTENCES) {
    if (sentences.length >= MIN_SENTENCES) break;
    if (!sentences.includes(filler)) sentences.push(filler);
  }

  return sentences.slice(0, MAX_SENTENCES).join('\n\n');
}

module.exports = {
  formatReply,
  cleanModelFormatting,
  mergeOrphanFragments,
  splitSentences,
  wordCount,
  MIN_SENTENCES,
  MAX_SENTENCES,
  MAX_WORDS_PER_SENTENCE
};
