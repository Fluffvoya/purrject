// Uses Chrome's DevTools protocol and Node's built-in WebSocket; no npm packages.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = resolve(process.argv[2] ?? '/tmp/purrject-graph-tests');
const endpoint = process.argv[3] ?? 'http://127.0.0.1:9222';
const tabs = await (await fetch(`${endpoint}/json`)).json();
const tab = tabs.find(tab => tab.type === 'page');
assert.ok(tab, 'A Chrome page must be available');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const errors = [];
const networkRequests = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Network.requestWillBeSent' && /^https?:/.test(message.params.request.url)) {
    networkRequests.push(message.params.request.url);
  }
  if (!message.id) return;
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  if (message.error) task.reject(new Error(JSON.stringify(message.error)));
  else task.resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function open(name) {
  const url = pathToFileURL(resolve(directory, name)).href;
  await call('Page.navigate', { url });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && document.getElementById('graph')?.dataset.settled === 'true'`)) {
      // Let Chrome commit the final SVG transforms before dispatching pointer input.
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      return;
    }
    await pause(100);
  }
  throw new Error(`${name} did not settle`);
}
async function screenshot(name) {
  await pause(220); // Let selection and theme color transitions finish.
  const result = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(directory, name), Buffer.from(result.data, 'base64'));
}
async function mouse(type, x, y, extra = {}) {
  await call('Input.dispatchMouseEvent', { type, x, y, ...extra });
}
async function waitForIdle() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("document.getElementById('graph').dataset.motion === 'idle'")) return;
    await pause(50);
  }
  throw new Error('Elastic motion did not settle');
}
const positions = () => evaluate(`Object.fromEntries([...document.querySelectorAll('.node')].map(node => {
  const matrix = node.transform.baseVal.consolidate().matrix;
  return [node.dataset.id, { x: matrix.e, y: matrix.f }];
}))`);

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }
  ] });
  await open('example.html');
  const stats = await evaluate(`(() => {
    const data = JSON.parse(document.getElementById('graph-data').textContent);
    return { nodes: document.querySelectorAll('.node').length, edges: document.querySelectorAll('.edge').length,
      expectedNodes: data.nodes.length, expectedEdges: data.edges.length,
      sizes: [...document.querySelectorAll('.node')].map(node => ({ id: node.dataset.id,
        r: Number(node.querySelector('.node-body').getAttribute('r')),
        incoming: new Set(data.edges.filter(edge => edge.to === node.dataset.id).map(edge => edge.from)).size })) };
  })()`);
  assert.equal(stats.nodes, stats.expectedNodes);
  assert.equal(stats.edges, stats.expectedEdges);
  for (const a of stats.sizes) for (const b of stats.sizes) if (a.incoming > b.incoming) assert.ok(a.r > b.r);
  await evaluate("document.documentElement.dataset.theme === 'dark' && document.getElementById('theme-toggle').click()");
  await screenshot('day.png');
  assert.equal(await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--page').trim()"), '#faf9f5');
  assert.equal(await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"), '#c37053');

  const originalPositions = await positions();
  const before = await evaluate(`(() => {
    const node = document.querySelector('.node[data-id="api"]');
    const rect = node.querySelector('.node-body').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
      transform: node.getAttribute('transform'), path: document.querySelector('.edge[data-from="api"]').getAttribute('d') };
  })()`);
  await mouse('mouseMoved', before.x, before.y);
  await mouse('mousePressed', before.x, before.y, { button: 'left', buttons: 1, clickCount: 1 });
  await mouse('mouseMoved', before.x + 90, before.y + 40, { button: 'left', buttons: 1 });
  await pause(140);
  const duringDrag = await positions();
  assert.ok(duringDrag.auth.x - originalPositions.auth.x > 1, 'A dependency follows the dragged node');
  assert.ok(duringDrag.gateway.x - originalPositions.gateway.x > 1, 'A dependent follows the dragged node');
  assert.ok(duringDrag.auth.x - originalPositions.auth.x < duringDrag.api.x - originalPositions.api.x, 'Neighbors follow partially');
  const pinned = await evaluate(`(() => { const r = document.querySelector('.node[data-id="api"] .node-body').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  assert.ok(Math.abs(pinned.x - before.x - 90) < 1 && Math.abs(pinned.y - before.y - 40) < 1, 'Grabbed node stays under the pointer');
  await mouse('mouseReleased', before.x + 90, before.y + 40, { button: 'left', clickCount: 1 });
  await waitForIdle();
  const settledPositions = await positions();
  assert.deepEqual(settledPositions.api, duringDrag.api, 'Released node stays where it was placed');
  await pause(120);
  assert.deepEqual(await positions(), settledPositions, 'The graph stops moving after settling');
  const after = await evaluate(`(() => {
    const node = document.querySelector('.node[data-id="api"]');
    const data = JSON.parse(document.getElementById('graph-data').textContent);
    const expected = new Set(['api', ...data.edges.filter(e => e.from === 'api').map(e => e.to), ...data.edges.filter(e => e.to === 'api').map(e => e.from)]);
    return { transform: node.getAttribute('transform'), path: document.querySelector('.edge[data-from="api"]').getAttribute('d'),
      selected: node.classList.contains('selected'),
      relatedNodes: [...document.querySelectorAll('.node:not(.dimmed)')].map(node => node.dataset.id).sort(), expectedNodes: [...expected].sort(),
      outgoing: document.querySelectorAll('.edge.outgoing').length, expectedOutgoing: data.edges.filter(e => e.from === 'api').length,
      incoming: document.querySelectorAll('.edge.incoming').length, expectedIncoming: data.edges.filter(e => e.to === 'api').length,
      document: document.getElementById('document-link').href,
      marker: getComputedStyle(document.querySelector('.edge.outgoing')).markerEnd };
  })()`);
  assert.notEqual(after.transform, before.transform, 'Dragging moves the node');
  assert.notEqual(after.path, before.path, 'Edges follow the dragged node');
  assert.ok(after.selected);
  assert.deepEqual(after.relatedNodes, after.expectedNodes);
  assert.equal(after.outgoing, after.expectedOutgoing);
  assert.equal(after.incoming, after.expectedIncoming);
  assert.match(after.document, /example\/doc\/api\.md$/);
  assert.match(after.marker, /arrow-outgoing/);
  assert.ok(await evaluate("document.querySelectorAll('.edge-flow.outgoing').length > 0"), 'Selected arrows have directional flow');
  await mouse('mouseMoved', 20, 20);
  await screenshot('selection.png');

  await evaluate("document.getElementById('theme-toggle').click()");
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  assert.equal(await evaluate("document.querySelectorAll('.node.selected').length"), 1);
  await screenshot('night.png');
  await open('example.html');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark', 'Theme preference survives reload');
  await evaluate("document.getElementById('theme-toggle').click()");
  await evaluate(`(() => { const input = document.getElementById('search'); input.value = 'utils'; input.dispatchEvent(new Event('input')); })()`);
  assert.equal(await evaluate("document.querySelectorAll('#module-list > li:not([hidden])').length"), 1);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.node:not(.dimmed)')].map(n => n.dataset.id)"), ['utils']);
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
  assert.equal(await evaluate("document.querySelectorAll('.node.dimmed').length"), 0);
  await evaluate("document.querySelector('.node[data-id=\"db\"]').focus(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
  assert.equal(await evaluate("document.getElementById('selected-name').textContent"), 'db');
  assert.equal(await evaluate('document.activeElement.dataset.id'), 'db', 'Keyboard selection preserves focus');
  await mouse('mousePressed', 15, 600, { button: 'left', buttons: 1, clickCount: 1 });
  await mouse('mouseReleased', 15, 600, { button: 'left', clickCount: 1 });
  assert.equal(await evaluate("document.querySelectorAll('.node.selected').length"), 0, 'Blank canvas clears selection');
  const oldZoom = await evaluate("document.getElementById('zoom-level').textContent");
  await evaluate("document.getElementById('zoom-in').click()");
  assert.notEqual(await evaluate("document.getElementById('zoom-level').textContent"), oldZoom);
  const oldCamera = await evaluate("document.getElementById('viewport').getAttribute('transform')");
  await mouse('mousePressed', 15, 600, { button: 'left', buttons: 1, clickCount: 1 });
  await mouse('mouseMoved', 40, 620, { buttons: 1 });
  await mouse('mouseReleased', 40, 620, { button: 'left', clickCount: 1 });
  assert.notEqual(await evaluate("document.getElementById('viewport').getAttribute('transform')"), oldCamera, 'Dragging canvas pans the graph');
  await evaluate("document.getElementById('fit-view').click()");

  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(150);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile has no horizontal overflow');
  assert.ok(await evaluate(`(() => { const graph = document.getElementById('graph').getBoundingClientRect();
    return [...document.querySelectorAll('.node-body')].every(node => { const r = node.getBoundingClientRect();
      return r.left >= graph.left && r.right <= graph.right && r.top >= graph.top && r.bottom <= graph.bottom; }); })()`), 'Nodes fit mobile canvas');
  await screenshot('mobile.png');

  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await open('relations.html');
  await evaluate("document.querySelector('.module-row[data-id=\"a\"]').click()");
  assert.ok(await evaluate("document.querySelector('.node[data-id=\"b\"]').classList.contains('both')"), 'Reciprocal neighbor has both relationships');
  assert.equal(await evaluate("document.querySelectorAll('.edge.outgoing').length"), 3);
  assert.equal(await evaluate("document.querySelectorAll('.edge.incoming').length"), 1);
  assert.ok(await evaluate("document.querySelector('.node[data-id=\"missing\"]').classList.contains('outgoing')"));
  assert.ok(await evaluate("document.querySelector('.node[data-id=\"isolated\"]').classList.contains('dimmed')"));
  assert.ok(await evaluate("document.querySelector('.edge[data-from=\"a\"][data-to=\"a\"]').getAttribute('d').includes('C')"), 'Self dependency has a loop');
  const isolatedBefore = await positions();
  const root = await evaluate(`(() => { const r = document.querySelector('.node[data-id="a"] .node-body').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await mouse('mousePressed', root.x, root.y, { button: 'left', buttons: 1, clickCount: 1 });
  await mouse('mouseMoved', root.x + 100, root.y + 50, { buttons: 1 });
  await pause(100);
  // A second movement during the same drag must continue to pull the same springs.
  await mouse('mouseMoved', root.x + 140, root.y + 65, { buttons: 1 });
  await mouse('mouseReleased', root.x + 140, root.y + 65, { button: 'left', clickCount: 1 });
  await waitForIdle();
  const isolatedAfter = await positions();
  assert.deepEqual(isolatedAfter.isolated, isolatedBefore.isolated, 'Unconnected modules stay still');
  assert.ok(isolatedAfter.b.x > isolatedBefore.b.x + 1, 'Reciprocal connections follow without instability');
  assert.ok(await evaluate("[...document.querySelectorAll('.edge')].every(e => !/NaN|Infinity/.test(e.getAttribute('d')))"));
  await open('empty.html');
  assert.equal(await evaluate("document.getElementById('empty-state').hidden"), false);
  await open('special.html');
  assert.equal(await evaluate('globalThis.injected'), undefined);
  assert.equal(await evaluate("document.querySelector('.node text').textContent"), await evaluate("JSON.parse(document.getElementById('graph-data').textContent).nodes[0].id"));
  await evaluate("document.querySelector('.module-row').click()");
  assert.equal(await evaluate("document.getElementById('selected-intro').textContent"), await evaluate("JSON.parse(document.getElementById('graph-data').textContent).nodes[0].intro"));
  await open('large.html');
  assert.equal(await evaluate("document.querySelectorAll('.node').length"), 180);
  assert.ok(await evaluate("[...document.querySelectorAll('.edge')].every(e => !/NaN|Infinity/.test(e.getAttribute('d')))"));
  const deniedStorage = await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
    Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  ` });
  await call('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }
  ] });
  await open('example.html');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark', 'System theme works with storage disabled');
  await evaluate("document.getElementById('theme-toggle').click()");
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light', 'Theme toggle works with storage disabled');
  const reducedBefore = await positions();
  const reducedRoot = await evaluate(`(() => { const r = document.querySelector('.node[data-id="api"] .node-body').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await mouse('mousePressed', reducedRoot.x, reducedRoot.y, { button: 'left', buttons: 1, clickCount: 1 });
  await mouse('mouseMoved', reducedRoot.x + 70, reducedRoot.y + 30, { buttons: 1 });
  await mouse('mouseReleased', reducedRoot.x + 70, reducedRoot.y + 30, { button: 'left', clickCount: 1 });
  assert.equal(await evaluate("document.getElementById('graph').dataset.motion"), 'idle', 'Reduced motion skips inertial settling');
  const reducedAfter = await positions();
  assert.ok(reducedAfter.auth.x > reducedBefore.auth.x + 1, 'Reduced motion keeps direct neighbor feedback');
  await pause(150);
  assert.deepEqual(await positions(), reducedAfter, 'Reduced motion does not oscillate');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.edge-flow.outgoing')).display"), 'none');
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: deniedStorage.identifier });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  assert.deepEqual(networkRequests, [], 'Graph works without network requests');
  console.log(`Browser checks passed: elastic neighbor following, stable release, isolated nodes, reduced motion, warm themes, arrows, highlights, theme persistence, search, keyboard, pan/zoom, mobile, empty/special/cyclic/large graphs. Screenshots: ${directory}`);
} finally {
  socket.close();
}
