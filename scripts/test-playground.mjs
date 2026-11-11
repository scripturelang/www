// Exercise the actual UI controller with a small DOM and Worker harness.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lessons } from '../web/lessons.js';

const controller = readFileSync(
  new URL('../web/playground.js', import.meta.url),
  'utf8',
).replace(/^import .*;\n/, '');
const storageKey = 'scripture-playground-v2';
function mount({
  storage = new Map(),
  mobile = false,
  storageFails = false,
} = {}) {
  const metrics = { storageWrites: 0, gutterWrites: 0 };
  const documentHandlers = {};
  const windowHandlers = {};
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        value: '',
        _textContent: '',
        get textContent() {
          return this._textContent;
        },
        set textContent(value) {
          this._textContent = value;
          if (id === 'line-numbers') metrics.gutterWrites++;
        },
        hidden: false,
        disabled: false,
        open: false,
        scrollTop: 0,
        selectionStart: 0,
        selectionEnd: 0,
        handlers: {},
        attributes: {},
        dataset: {},
        addEventListener(name, callback) {
          this.handlers[name] = callback;
        },
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        removeAttribute(name) {
          delete this.attributes[name];
        },
        focus() {
          this.focused = true;
        },
        scrollIntoView() {
          this.revealed = true;
        },
        setSelectionRange(start, end) {
          this.selectionStart = start;
          this.selectionEnd = end;
        },
        setRangeText(text, start, end) {
          this.value =
            this.value.slice(0, start) + text + this.value.slice(end);
        },
      });
    return elements.get(id);
  };
  const workers = [];
  const timers = new Map();
  let now = 0;
  let timerId = 0;
  function advance(milliseconds) {
    const target = now + milliseconds;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      const [id, timer] = next;
      now = timer.at;
      timers.delete(id);
      timer.callback();
    }
    now = target;
  }
  class Worker {
    constructor(url, options) {
      assert.equal(url, './worker.js?loader=manifest-v1');
      assert.equal(options.type, 'module');
      workers.push(this);
    }
    postMessage(data) {
      this.data = data;
    }
    terminate() {
      this.terminated = true;
    }
  }
  const context = {
    lessons,
    Worker,
    document: {
      getElementById: element,
      querySelector: element,
      body: { classList: { add() {} } },
      visibilityState: 'visible',
      addEventListener(name, callback) {
        documentHandlers[name] = callback;
      },
    },
    window: {
      addEventListener(name, callback) {
        windowHandlers[name] = callback;
      },
    },
    localStorage: {
      getItem: (key) => {
        if (storageFails) throw Error('disabled');
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => {
        metrics.storageWrites++;
        if (storageFails) throw Error('full');
        storage.set(key, value);
      },
    },
    matchMedia: () => ({ matches: mobile }),
    setTimeout: (callback, delay) => {
      timers.set(++timerId, { callback, at: now + delay });
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(controller, context);
  const click = (id) => element(id).handlers.click();
  const edit = (text) => {
    element('source').value = text;
    element('source').handlers.input();
  };
  const load = (name) => {
    element('example').value = name;
    click('load');
  };
  return {
    element,
    workers,
    click,
    edit,
    load,
    storage,
    metrics,
    advance,
    timeout: () => advance(10000),
    blur: () => element('source').handlers.blur(),
    pagehide: () => windowHandlers.pagehide(),
    visibility: (state) => {
      context.document.visibilityState = state;
      documentHandlers.visibilitychange();
    },
    setStorageFails: (value) => {
      storageFails = value;
    },
  };
}

const ui = mount({ mobile: true });
const { element, workers, click } = ui;
assert.equal(element('source').value, lessons.hello.source);
assert.equal(element('lesson-title').textContent, lessons.hello.title);
click('run');
assert.equal(element('run').disabled, true);
assert.equal(element('stop').disabled, false);
assert.equal(element('workspace').dataset.view, 'output');
assert.equal(element('workspace').revealed, true);
assert.equal(workers[0].data.source, lessons.hello.source);
assert.deepEqual(Object.keys(workers[0].data), ['source']);
ui.load('values');
assert.equal(
  element('source').value,
  lessons.hello.source,
  'cannot replace source during execution',
);
click('stop');
assert.equal(workers[0].terminated, true);
assert.equal(element('status').textContent, 'Stopped');
workers[0].onmessage({ data: { output: ['stale'], error: null } });
assert.equal(element('status').textContent, 'Stopped');
assert.equal(element('output').textContent, '');
click('run');
workers[0].onerror({ preventDefault() {}, message: 'stale failure' });
assert.equal(element('status').textContent, 'Running');
workers[1].onmessage({
  data: { output: ['before'], error: 'line 2, column 5: division by zero' },
});
assert.equal(element('output').textContent, 'before');
assert.match(element('error-summary').textContent, /cannot be divided by zero/);
assert.equal(element('error-details').open, false);
assert.equal(element('error-box').hidden, false);
assert.equal(element('run').disabled, false);
click('error-location');
assert.equal(element('workspace').dataset.view, 'source');
assert.equal(element('source').focused, true);
assert.equal(
  element('source').selectionStart,
  lessons.hello.source.indexOf('praise'),
);
ui.edit(lessons.hello.source + '\n');
assert.equal(
  element('error-location').hidden,
  true,
  'old diagnostic must not jump into changed source',
);
assert.equal(element('source').attributes['aria-invalid'], undefined);
click('run');
workers[2].onmessage({ data: { output: [], error: null } });
assert.equal(element('placeholder').hidden, false);
assert.equal(element('status').textContent, 'Complete');
click('run');
ui.timeout();
assert.equal(workers[3].terminated, true);
assert.match(element('error').textContent, /10 seconds/);
assert.equal(element('run').disabled, false);

// Every example retains its own edits, including across reloads.
const ownCode = 'genesis:\n    praise "My experiment"\namen\n';
ui.edit(ownCode);
ui.load('values');
assert.equal(element('source').value, lessons.values.source);
ui.edit('let there be count = 9');
ui.load('functions');
ui.load('hello');
assert.equal(element('source').value, ownCode);
ui.load('values');
assert.equal(element('source').value, 'let there be count = 9');
const reopened = mount({ storage: ui.storage });
assert.equal(reopened.element('example').value, 'values');
assert.equal(reopened.element('source').value, 'let there be count = 9');
reopened.click('reset');
assert.equal(reopened.element('source').value, lessons.values.source);
const resetReload = mount({ storage: ui.storage });
resetReload.click('undo-load');
assert.equal(
  resetReload.element('source').value,
  'let there be count = 9',
  'undo survives a reload',
);
resetReload.load('functions');
resetReload.click('undo-load');
assert.equal(resetReload.element('example').value, 'values');
assert.equal(resetReload.element('source').value, 'let there be count = 9');
assert.equal(resetReload.element('draft-notice').hidden, true);

const migrated = mount({
  storage: new Map([['scripture-playground-draft-v1', ownCode]]),
});
assert.equal(migrated.element('example').value, 'custom');
assert.equal(migrated.element('source').value, ownCode);
assert.equal(migrated.element('expected-details').hidden, true);
assert.equal(
  mount({ storageFails: true }).element('draft-status').textContent,
  'Not saved in this browser',
);
assert.equal(
  mount({ storage: new Map([[storageKey, '{broken']]) }).element('source')
    .value,
  lessons.hello.source,
);
assert.equal(
  mount({
    storage: new Map([
      [
        storageKey,
        JSON.stringify({ activeLesson: '__proto__', drafts: { hello: 123 } }),
      ],
    ]),
  }).element('source').value,
  lessons.hello.source,
);

const next = mount();
next.click('run');
next.workers[0].onmessage({ data: { output: ['Hallelujah'], error: null } });
assert.equal(next.element('next-lesson').hidden, false);
next.edit('genesis: praise \"My greeting\" amen');
next.click('run');
next.workers
  .at(-1)
  .onmessage({ data: { output: ['My greeting'], error: null } });
assert.equal(
  next.element('next-lesson').hidden,
  false,
  'Successful experiments can continue to the next lesson',
);
next.click('next-lesson');
assert.equal(next.element('example').value, 'values');
assert.equal(next.element('workspace').dataset.view, 'source');
next.click('view-output');
assert.equal(next.element('view-output').attributes['aria-pressed'], 'true');
next.click('view-source');
assert.equal(next.element('view-output').attributes['aria-pressed'], 'false');
const timeLesson = mount();
timeLesson.element('example').value = 'prophecy';
timeLesson.click('load');
timeLesson.click('run');
timeLesson.workers[0].onmessage({
  data: { output: lessons.prophecy.output, error: null },
});
assert.equal(
  timeLesson.element('next-lesson').textContent,
  'Next: time of our lord',
);
timeLesson.click('next-lesson');
assert.equal(timeLesson.element('example').value, 'time');
assert.equal(timeLesson.element('source').value, lessons.time.source);
assert.equal(
  timeLesson.element('expected-output').textContent,
  lessons.time.output.join('\n'),
);
let prevented = false;
const key = (value, extra = {}) =>
  next.element('source').handlers.keydown({
    key: value,
    preventDefault() {
      prevented = true;
    },
    ...extra,
  });
key('Tab');
assert.equal(prevented, true);
key('Escape');
prevented = false;
key('Tab');
assert.equal(
  prevented,
  false,
  'Escape then Tab must allow forward keyboard navigation',
);
key('Tab', { shiftKey: true });
assert.equal(
  prevented,
  false,
  'Shift+Tab must retain native backwards navigation',
);

// Typing coalesces storage writes and leaves unchanged line numbers alone.
const typing = mount();
const initialWrites = { ...typing.metrics };
for (let i = 0; i < 100; i++)
  typing.edit(lessons.hello.source + 'a'.repeat(i + 1));
assert.deepEqual(typing.metrics, initialWrites);
assert.equal(typing.element('draft-status').textContent, 'Saving…');
typing.advance(299);
assert.equal(typing.metrics.storageWrites, initialWrites.storageWrites);
typing.edit(lessons.hello.source + 'latest');
typing.advance(299);
assert.equal(typing.metrics.storageWrites, initialWrites.storageWrites);
typing.advance(1);
assert.equal(typing.metrics.storageWrites, initialWrites.storageWrites + 1);
assert.equal(
  JSON.parse(typing.storage.get(storageKey)).drafts.hello,
  lessons.hello.source + 'latest',
);
assert.equal(
  typing.element('draft-status').textContent,
  'Edited · saved locally',
);
typing.advance(2000);
assert.equal(
  typing.metrics.storageWrites,
  initialWrites.storageWrites + 1,
  'successful saves cancel the deadline',
);
typing.edit('first\nsecond\n');
assert.equal(typing.element('line-numbers').textContent, '1\n2\n3');
assert.equal(typing.metrics.gutterWrites, initialWrites.gutterWrites + 1);
typing.edit('first');
assert.equal(typing.element('line-numbers').textContent, '1');
typing.edit('');
assert.equal(typing.element('line-numbers').textContent, '1');
assert.equal(typing.metrics.gutterWrites, initialWrites.gutterWrites + 2);
typing.element('source').scrollTop = 52;
typing.element('source').handlers.scroll();
assert.equal(typing.element('line-numbers').scrollTop, 52);
assert.equal(typing.metrics.gutterWrites, initialWrites.gutterWrites + 2);

const continuous = mount();
for (let i = 0; i < 20; i++) {
  continuous.edit(`draft ${i}`);
  continuous.advance(100);
}
assert.equal(
  continuous.metrics.storageWrites,
  2,
  'continuous input saves at the maximum wait',
);
assert.equal(
  JSON.parse(continuous.storage.get(storageKey)).drafts.hello,
  'draft 19',
);
continuous.edit('after deadline');
continuous.advance(300);
assert.equal(continuous.metrics.storageWrites, 3);

// Leaving the editor or page flushes pending changes exactly once.
for (const flush of [
  (ui) => ui.blur(),
  (ui) => ui.visibility('hidden'),
  (ui) => ui.pagehide(),
]) {
  const leaving = mount();
  leaving.edit('pending draft');
  leaving.visibility('visible');
  assert.equal(leaving.metrics.storageWrites, 1);
  flush(leaving);
  assert.equal(leaving.metrics.storageWrites, 2);
  assert.equal(
    mount({ storage: leaving.storage }).element('source').value,
    'pending draft',
  );
  flush(leaving);
  leaving.advance(2000);
  assert.equal(leaving.metrics.storageWrites, 2);
}

// Immediate actions save the correct lesson, undo state, and execution source.
const switching = mount();
switching.edit('hello edit');
switching.load('values');
switching.edit('values edit');
switching.click('undo-load');
switching.advance(2000);
const switched = JSON.parse(switching.storage.get(storageKey));
assert.equal(switched.drafts.hello, 'hello edit');
assert.equal(switched.drafts.values, 'values edit');
assert.equal(switched.activeLesson, 'hello');
assert.equal(switched.previous, null);
switching.edit('reset me');
switching.click('reset');
assert.equal(
  JSON.parse(switching.storage.get(storageKey)).previous.source,
  'reset me',
);
switching.click('undo-load');
assert.equal(switching.element('source').value, 'reset me');
switching.edit('run me');
switching.click('run');
assert.equal(
  JSON.parse(switching.storage.get(storageKey)).drafts.hello,
  'run me',
);
switching.edit('edited while running');
switching.advance(300);
assert.equal(
  JSON.parse(switching.storage.get(storageKey)).drafts.hello,
  'edited while running',
);
assert.equal(switching.workers[0].terminated, undefined);
switching.advance(9700);
assert.equal(
  switching.workers[0].terminated,
  true,
  'draft timers must not cancel the execution timeout',
);

const failedSave = mount();
failedSave.setStorageFails(true);
failedSave.edit('recoverable');
failedSave.advance(300);
assert.equal(
  failedSave.element('draft-status').textContent,
  'Not saved in this browser',
);
failedSave.setStorageFails(false);
failedSave.pagehide();
assert.equal(
  JSON.parse(failedSave.storage.get(storageKey)).drafts.hello,
  'recoverable',
);
assert.equal(
  failedSave.element('draft-status').textContent,
  'Edited · saved locally',
);

// The worker must await the async Wasm report before parsing or posting it.
const reports = [];
let resume;
const workerSelf = { postMessage: (report) => reports.push(report) };
const workerContext = {
  self: workerSelf,
  loadRuntime: async () => ({
    run_script: () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  }),
};
const workerSource = readFileSync(
  new URL('../web/worker.js', import.meta.url),
  'utf8',
).replace(/^import .*;\n/, '');
vm.runInNewContext(workerSource, workerContext);
const pendingReport = workerSelf.onmessage({
  data: { source: 'genesis: pray 0.01 amen' },
});
await new Promise(setImmediate);
assert.equal(reports.length, 0);
resume(JSON.stringify({ output: ['after'], error: null }));
await pendingReport;
assert.equal(
  JSON.stringify(reports),
  JSON.stringify([{ output: ['after'], error: null }]),
);
workerContext.loadRuntime = async () => {
  throw new Error('Could not load the interpreter manifest (HTTP 404).');
};
await workerSelf.onmessage({ data: { source: lessons.time.source } });
assert.match(
  reports.at(-1).error,
  /Could not load the interpreter manifest \(HTTP 404\)/,
);
console.log(
  'Guided lessons, draft recovery, mobile views, keyboard escape, diagnostics, worker lifecycle, and async reports passed.',
);
