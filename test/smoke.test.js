'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'campuscycle-test-'));
process.env.DATA_FILE = path.join(root, 'items.json');
process.env.FEEDBACK_FILE = path.join(root, 'feedback.json');
const { app, storage } = require('../server');
const server = app.listen(0);
const base = () => 'http://127.0.0.1:' + server.address().port;
async function call(route, options = {}) {
  const response = await fetch(base() + route, options);
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body, headers: response.headers };
}
function post(body) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
const valid = overrides => ({
  title: 'Scientific calculator', price: 650, category: 'Calculators', condition: 'Good',
  description: 'Working calculator for exam use', location: 'Coimbatore',
  college: 'Example Engineering College', contact: 'synthetic@example.test', ...(overrides || {})
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
});

test('health checks JSON stores', async () => {
  const result = await call('/health');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'ok' });
});
test('categories include the supported student marketplace groups', async () => {
  const result = await call('/api/categories');
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 9);
  assert.ok(result.body.includes('Calculators'));
  assert.ok(result.body.includes('Hostel Essentials'));
});
test('listing creation generates server-owned identifiers and status', async () => {
  const result = await call('/api/items', post(valid({ id: 'client-id', sold: true, createdAt: 'fake' })));
  assert.equal(result.status, 201);
  assert.notEqual(result.body.id, 'client-id');
  assert.equal(result.body.sold, false);
  assert.notEqual(result.body.createdAt, 'fake');
  assert.equal(result.body.price, 650);
});
test('listing validation rejects blank title and missing contact', async () => {
  assert.equal((await call('/api/items', post(valid({ title: ' ' })))).status, 400);
  assert.equal((await call('/api/items', post(valid({ contact: '' })))).status, 400);
});
test('listing validation rejects invalid price and condition', async () => {
  assert.equal((await call('/api/items', post(valid({ price: -1 })))).status, 400);
  assert.equal((await call('/api/items', post(valid({ price: '650' })))).status, 400);
  assert.equal((await call('/api/items', post(valid({ condition: 'Broken' })))).status, 400);
});
test('listing validation caps field lengths and defaults unsupported category', async () => {
  assert.equal((await call('/api/items', post(valid({ title: 'x'.repeat(81) })))).status, 400);
  assert.equal((await call('/api/items', post(valid({ description: 'x'.repeat(1001) })))).status, 400);
  const result = await call('/api/items', post(valid({ category: 'Unknown Group' })));
  assert.equal(result.status, 201);
  assert.equal(result.body.category, 'Other');
});
test('browse search checks title and description and sorts/filter active items', async () => {
  const created = await call('/api/items', post(valid()));
  const id = created.body.id;
  assert.equal((await call('/api/items?q=calculator')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?q=exam%20use')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?category=Calculators')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?minPrice=600&maxPrice=700')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?condition=Good')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?college=engineering')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?location=coimbatore')).body.some(x => x.id === id), true);
  assert.equal((await call('/api/items?category=Calculators&minPrice=651')).body.some(x => x.id === id), false);
});
test('item details and sold transition work', async () => {
  const created = await call('/api/items', post(valid({ title: 'Sold test bicycle', category: 'Cycles & Transport', price: 1400 })));
  const id = created.body.id;
  assert.equal((await call('/api/items/' + id)).status, 200);
  assert.equal((await call('/api/items/' + id + '/sold', { method: 'POST' })).status, 200);
  assert.equal((await call('/api/items?q=bicycle')).body.some(x => x.id === id), false);
  assert.equal((await call('/api/items/not-a-real-id')).status, 404);
});
test('assistant recommends real listings and respects budget', async () => {
  await call('/api/items', post(valid({ title: 'Budget-test calculator', price: 500 })));
  await call('/api/items', post(valid({ title: 'Expensive calculator', price: 1800 })));
  const result = await call('/api/assistant', post({ message: 'Find a calculator under 700' }));
  assert.equal(result.status, 200);
  assert.equal(result.body.type, 'recommendations');
  assert.ok(result.body.items.some(item => item.title === 'Budget-test calculator'));
  assert.equal(result.body.items.some(item => item.title === 'Expensive calculator'), false);
});
test('assistant excludes sold listings and reports no matches without inventing goods', async () => {
  const created = await call('/api/items', post(valid({ title: 'Only sold Casio calculator', price: 300 })));
  await call('/api/items/' + created.body.id + '/sold', { method: 'POST' });
  const sold = await call('/api/assistant', post({ message: 'Find a calculator under 700' }));
  assert.equal(sold.body.items.some(item => item.id === created.body.id), false);
  const none = await call('/api/assistant', post({ message: 'Find a bicycle under 1' }));
  assert.equal(none.body.items.length, 0);
  assert.match(none.body.message, /couldn.t find/i);
});
test('assistant answers FAQ and handles invalid or unsupported input', async () => {
  assert.equal((await call('/api/assistant', post({ message: 'Can I pay online?' }))).body.type, 'faq');
  assert.equal((await call('/api/assistant', post({ message: 'Explain quantum gravity' }))).body.type, 'unsupported');
  assert.equal((await call('/api/assistant', post({ message: ' ' }))).status, 400);
  assert.equal((await call('/api/assistant', post({ message: 'x'.repeat(1001) }))).status, 400);
});
test('feedback validates then persists before reporting success', async () => {
  const before = storage.readFeedback().length;
  const result = await call('/api/feedback', post({ rating: 5, category: 'Suggestion', message: 'Synthetic feedback test' }));
  assert.equal(result.status, 201);
  assert.equal(storage.readFeedback().length, before + 1);
  assert.equal((await call('/api/feedback', post({ rating: 8, category: 'Suggestion', message: 'Bad rating' }))).status, 400);
});
test('unknown routes and malformed or oversized request bodies use JSON errors', async () => {
  const unknown = await call('/not-a-real-route');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'ROUTE_NOT_FOUND');
  const malformed = await fetch(base() + '/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'MALFORMED_JSON');
  const large = await fetch(base() + '/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(103 * 1024) }) });
  assert.equal(large.status, 413);
});
test('frontend contains the required sections and renders user text without innerHTML', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const id of ['browse', 'sell', 'faq', 'assistant', 'feedback']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.equal((html.match(/<summary>/g) || []).length, 0, 'FAQ questions are built from a safe static data array');
  assert.match(html, /textContent/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
});
