const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function frontend() {
  const canvases = new Map();
  const frames = new Map();
  const created = [];
  const observers = [];
  const buttons = ['gradient', 'brand'].map(theme => ({ dataset: { theme }, classList: { toggle() {}, remove() {}, add() {} }, addEventListener(event, fn) { this.click = fn; } }));
  let frameId = 0;
  class Element {
    constructor() { this.dataset = {}; this.children = []; this.width = 0; this.height = 0; }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<canvas[^>]*id="([^"]+)"/g)) {
        const canvas = new Element(); canvas.id = match[1];
        canvas.getContext = () => ({ canvas });
        canvases.set(canvas.id, canvas);
      }
    }
    appendChild(child) { this.children.push(child); }
    querySelectorAll() { return buttons; }
    getBoundingClientRect() { return { top: 0, bottom: 400 }; }
  }
  const content = new Element();
  const document = { getElementById: id => id === 'content' ? content : canvases.get(id), createElement: () => new Element() };
  class Chart {
    constructor(ctx, config) { this.canvas = ctx.canvas; this.config = config; this.data = config.data; this.options = config.options; this.destroyed = false; this.updates = []; created.push(this); }
    destroy() { this.destroyed = true; }
    update(mode) { this.updates.push(mode); }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.disconnected = true; }
  }
  const context = vm.createContext({ Chart, document, IntersectionObserver, window: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, addEventListener() {}, removeEventListener() {} }, URL,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
  });
  const scripts = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
  vm.runInContext(scripts.at(-1)[1].replace(/loadData\(\);\s*$/, ''), context);
  const data = Array.from({ length: 25 }, (_, i) => ({ label: `Benchmark ${i}`, description: '一句介绍', tier: 'frontier', models: [['Model', 60]] }));
  context.testData = data;
  const render = () => vm.runInContext('cachedData = testData; render(testData);', context);
  const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); return callbacks.length; };
  const drain = () => { let limit = 100; while (frames.size && limit--) tick(); assert.ok(limit > 0); };
  const intersect = (index, visible) => { const observer = observers.at(-1); observer.callback([{ target: observer.targets[index], isIntersecting: visible }]); };
  return { context, render, tick, drain, intersect, created, observers, frames, content, buttons, canvases };
}

test('initial render defers chart creation until near the viewport', () => {
  const ui = frontend(); ui.render(); ui.drain();
  assert.equal(ui.created.length, 0, 'offscreen charts must not initialize');
  ui.intersect(0, true); ui.intersect(1, true);
  ui.tick(); assert.equal(ui.created.length, 1, 'only one chart may be constructed per frame');
  ui.tick(); assert.equal(ui.created.length, 2);
  assert.equal(ui.created[0].options.animation.duration, 1000);
  assert.equal(ui.created[0].options.animation.easing, 'easeOutQuart');
  assert.equal(ui.created[0].options.plugins.tooltip.animation, false);
  assert.equal(ui.created[0].options.devicePixelRatio, 1.5);
});

test('scrolling releases offscreen charts and cancels obsolete queued draws', () => {
  const ui = frontend(); ui.render();
  ui.intersect(0, true); ui.drain();
  ui.intersect(0, false);
  assert.equal(ui.created[0].destroyed, true);
  assert.equal(ui.canvases.get('chart_0').width, 0);
  ui.intersect(1, true); ui.intersect(1, false); ui.drain();
  assert.equal(ui.created.length, 1);
  ui.intersect(0, true); ui.drain();
  assert.equal(ui.created.length, 2);
  assert.equal(ui.created[1].options.animation, false, 'returning charts must not replay their entrance animation');
});

test('theme changes update mounted charts without reconstructing the whole page', () => {
  const ui = frontend(); ui.render(); ui.intersect(0, true); ui.drain();
  ui.buttons[0].click(); ui.drain();
  assert.equal(ui.created.length, 1);
  assert.equal(ui.created[0].destroyed, false);
  assert.deepEqual(ui.created[0].updates, ['none']);
  assert.equal(ui.created[0].data.datasets[0].backgroundColor[0], '#4f46e5');
  ui.intersect(1, true); ui.drain();
  assert.equal(ui.created[1].data.datasets[0].backgroundColor[0], '#4f46e5');
});

test('rerender disconnects observers and cancels stale animation-frame work', () => {
  const ui = frontend(); ui.render(); ui.intersect(0, true);
  ui.render(); ui.drain();
  assert.equal(ui.observers[0].disconnected, true);
  assert.equal(ui.created.length, 0);
});
