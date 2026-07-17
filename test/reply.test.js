const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatReply,
  splitSentences,
  wordCount,
  MIN_SENTENCES,
  MAX_SENTENCES,
  MAX_WORDS_PER_SENTENCE
} = require('../lib/reply');

test('keeps every answer between three and five sentences', () => {
  const shortReply = formatReply('Áno, túto službu poskytujeme.');
  const longReply = formatReply('Prvá veta. Druhá veta. Tretia veta. Štvrtá veta. Piata veta. Šiesta veta.');

  assert.equal(splitSentences(shortReply).length, MIN_SENTENCES);
  assert.equal(splitSentences(longReply).length, MAX_SENTENCES);
  assert.doesNotMatch(longReply, /Šiesta/u);
});

test('splits long compound sentences into short sentences', () => {
  const reply = formatReply(
    'Najprv si preveríme parcelu a územný plán, potom pripravíme architektonickú štúdiu, ktorá určí rozsah projektu a potrebné profesie pre povoľovací proces.'
  );
  const sentences = splitSentences(reply);

  assert.ok(sentences.length >= MIN_SENTENCES && sentences.length <= MAX_SENTENCES);
  assert.ok(sentences.every(sentence => !/^Ktor/u.test(sentence)), reply);
  for (const sentence of sentences) {
    assert.ok(wordCount(sentence) <= MAX_WORDS_PER_SENTENCE, sentence);
  }
});

test('does not split an email address into extra sentences', () => {
  const reply = formatReply(
    'Napíšte nám na aplan@aplan.sk. Ozveme sa Vám s ďalším postupom. Rozsah posúdime podľa Vášho zámeru.'
  );

  assert.equal(splitSentences(reply).length, MIN_SENTENCES);
  assert.match(reply, /aplan@aplan\.sk/u);
});
