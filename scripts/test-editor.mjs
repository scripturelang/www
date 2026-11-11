// Exercise the shipped Prism core and Scripture colors, without a DOM or parser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lessons } from '../web/lessons.js';

const context = vm.createContext({});
context.window = context;
for (const file of ['vendor/prism-1.30.0/prism-core.js', 'editor.js']) {
  vm.runInContext(
    readFileSync(new URL(`../web/${file}`, import.meta.url), 'utf8'),
    context,
  );
}
const { Prism } = context;
const tokens = (source) => Prism.tokenize(source, Prism.languages.scripture);
const colored = (source) =>
  Array.from(tokens(source))
    .filter((token) => typeof token !== 'string')
    .map(({ type, content }) => [type, content]);

assert.deepEqual(colored('let there be now = time of our lord()'), [
  ['keyword', 'let there be'],
  ['operator', '='],
  ['builtin', 'time of our lord'],
  ['punctuation', '('],
  ['punctuation', ')'],
]);
assert.deepEqual(
  colored('make it so that x = 3.5; if true and x not equal 2:'),
  [
    ['keyword', 'make it so that'],
    ['operator', '='],
    ['number', '3.5'],
    ['punctuation', ';'],
    ['keyword', 'if'],
    ['boolean', 'true'],
    ['operator', 'and'],
    ['operator', 'not equal'],
    ['number', '2'],
    ['punctuation', ':'],
  ],
);
assert.deepEqual(colored('genesis2 time of our lordly let  there be'), []);
assert.deepEqual(colored('time\nof our lord'), []);
assert.deepEqual(colored('"praise true 42 time of our lord"'), [
  ['string', '"praise true 42 time of our lord"'],
]);
assert.deepEqual(colored('"unfinished\nelse:'), [
  ['string', '"unfinished'],
  ['keyword', 'else'],
  ['punctuation', ':'],
]);
assert.deepEqual(colored('"literal\\" praise'), [
  ['string', '"literal\\"'],
  ['keyword', 'praise'],
]);
assert.deepEqual(colored('"<img src=x onerror=alert(1)>"'), [
  ['string', '"<img src=x onerror=alert(1)>"'],
]);
assert.ok(
  !Prism.highlight('"<img>"', Prism.languages.scripture, 'scripture').includes(
    '<img>',
  ),
  'source text must be escaped before displaying it as HTML',
);
for (const { source } of Object.values(lessons)) {
  assert.equal(
    tokens(source)
      .map((token) => (typeof token === 'string' ? token : token.content))
      .join(''),
    source,
    'highlighting preserves every character in an example',
  );
}
console.log(
  'Scripture highlighting, incomplete input, and HTML escaping passed.',
);
