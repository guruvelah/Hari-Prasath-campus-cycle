'use strict';

const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const { createStorage, StorageError } = require('./storage');
const { CATEGORIES, CONDITIONS, answerMessage } = require('./assistant');

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const storage = createStorage();
const FEEDBACK_CATEGORIES = ['Suggestion', 'Bug report', 'Usability', 'Other'];

function errorBody(code, message) { return { error: { code, message } }; }
function fail(res, status, code, message) { return res.status(status).json(errorBody(code, message)); }
function normalized(value) { return String(value ?? '').trim().toLocaleLowerCase('en'); }
function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  next();
});

// Same-origin browser access only; no permissive wildcard CORS.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  res.vary('Origin');
  if (!origin) return next();
  let parsed;
  try { parsed = new URL(origin); } catch { return fail(res, 403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed.'); }
  if (parsed.host !== req.get('host') || !['http:', 'https:'].includes(parsed.protocol)) {
    return fail(res, 403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed.');
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.json({ limit: '100kb', strict: true }));

function rateLimit({ windowMs = 60_000, max = 120, code = 'RATE_LIMIT_EXCEEDED', message = 'Too many requests. Please try again shortly.' } = {}) {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (now - bucket.start >= windowMs) buckets.delete(key);
  }, Math.min(windowMs, 60_000));
  cleanup.unref?.();
  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) { bucket = { start: now, count: 0 }; buckets.set(key, bucket); }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) return fail(res, 429, code, message);
    next();
  };
}
app.use('/api', rateLimit());
app.use('/api/assistant', rateLimit({ max: 30, code: 'ASSISTANT_RATE_LIMITED', message: 'The assistant is busy. Please try again in a minute.' }));
app.use('/api/feedback', rateLimit({ max: 10, code: 'FEEDBACK_RATE_LIMITED', message: 'Too many feedback submissions. Please try again later.' }));

function publicItem(item) {
  return {
    id: item.id, title: item.title, price: item.price, category: item.category,
    condition: item.condition, description: item.description, location: item.location,
    college: item.college, contact: item.contact, createdAt: item.createdAt, sold: item.sold === true
  };
}
function queryText(value, field, max = 120) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > max) {
    const error = new Error(field + ' must be text of at most ' + max + ' characters.');
    error.status = 400; error.code = 'INVALID_QUERY'; throw error;
  }
  return value.trim();
}
function parsePriceQuery(value, field) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    const error = new Error(field + ' must be a non-negative number.');
    error.status = 400; error.code = 'INVALID_PRICE_FILTER'; throw error;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(field + ' must be a non-negative number.');
    error.status = 400; error.code = 'INVALID_PRICE_FILTER'; throw error;
  }
  return number;
}

app.get('/health', (req, res, next) => {
  try { storage.readItems(); storage.readFeedback(); return res.status(200).json({ status: 'ok' }); }
  catch (error) { return next(error); }
});
app.get('/api/categories', (req, res) => res.status(200).json(CATEGORIES));

app.get('/api/items', (req, res, next) => {
  try {
    const q = queryText(req.query.q, 'q', 100).toLocaleLowerCase('en');
    const category = queryText(req.query.category, 'category', 80);
    const condition = queryText(req.query.condition, 'condition', 30);
    const college = queryText(req.query.college, 'college', 120).toLocaleLowerCase('en');
    const location = queryText(req.query.location, 'location', 80).toLocaleLowerCase('en');
    const minPrice = parsePriceQuery(req.query.minPrice, 'minPrice');
    const maxPrice = parsePriceQuery(req.query.maxPrice, 'maxPrice');
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
      return fail(res, 400, 'INVALID_PRICE_RANGE', 'Minimum price cannot exceed maximum price.');
    if (category && !CATEGORIES.includes(category)) return fail(res, 400, 'INVALID_CATEGORY_FILTER', 'Choose a supported category.');
    if (condition && !CONDITIONS.includes(condition)) return fail(res, 400, 'INVALID_CONDITION_FILTER', 'Choose New, Like New, Good, or Used.');

    let items = storage.readItems().filter(item => item.sold !== true);
    if (q) items = items.filter(item => (item.title + ' ' + item.description).toLocaleLowerCase('en').includes(q));
    if (category) items = items.filter(item => item.category === category);
    if (condition) items = items.filter(item => item.condition === condition);
    if (minPrice !== undefined) items = items.filter(item => item.price >= minPrice);
    if (maxPrice !== undefined) items = items.filter(item => item.price <= maxPrice);
    if (college) items = items.filter(item => normalized(item.college).includes(college));
    if (location) items = items.filter(item => normalized(item.location).includes(location));
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return res.status(200).json(items.map(publicItem));
  } catch (error) { return next(error); }
});

app.get('/api/items/:id', (req, res, next) => {
  try {
    const item = storage.readItems().find(entry => entry.id === req.params.id);
    if (!item) return fail(res, 404, 'ITEM_NOT_FOUND', 'That listing could not be found. It may have been removed or the link may be incorrect.');
    return res.status(200).json(publicItem(item));
  } catch (error) { return next(error); }
});

app.post('/api/items', (req, res, next) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) return fail(res, 400, 'INVALID_REQUEST_BODY', 'Send a JSON object describing the listing.');
    const stringFields = [['title', 80, true], ['description', 1000, false], ['location', 80, false], ['college', 120, false], ['contact', 80, true]];
    const values = {};
    for (const [field, max, required] of stringFields) {
      const value = body[field];
      if (value === undefined && !required) { values[field] = ''; continue; }
      if (typeof value !== 'string') return fail(res, 400, 'VALIDATION_ERROR', field + ' must be ' + (required ? 'nonempty ' : '') + 'text of at most ' + max + ' characters.');
      if (value.length > max) return fail(res, 400, 'FIELD_TOO_LONG', field + ' must not exceed ' + max + ' characters.');
      values[field] = value.trim();
      if (required && !values[field]) return fail(res, 400, 'VALIDATION_ERROR', (field === 'title' ? 'Title' : 'Contact') + ' is required.');
    }
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0)
      return fail(res, 400, 'INVALID_PRICE', 'Price must be a finite number greater than or equal to zero.');
    const category = typeof body.category === 'string' && CATEGORIES.includes(body.category.trim()) ? body.category.trim() : 'Other';
    let condition = 'Good';
    if (body.condition !== undefined) {
      if (typeof body.condition !== 'string') return fail(res, 400, 'INVALID_CONDITION', 'Condition must be New, Like New, Good, or Used.');
      const canonical = CONDITIONS.find(value => value.toLocaleLowerCase('en') === body.condition.trim().toLocaleLowerCase('en'));
      if (!canonical) return fail(res, 400, 'INVALID_CONDITION', 'Condition must be New, Like New, Good, or Used.');
      condition = canonical;
    }
    const item = {
      id: crypto.randomUUID(), title: values.title, price: body.price, category, condition,
      description: values.description, location: values.location, college: values.college,
      contact: values.contact, createdAt: new Date().toISOString(), sold: false
    };
    const items = storage.readItems();
    items.push(item); storage.saveItems(items);
    console.info('listing_created', JSON.stringify({ id: item.id, category: item.category, at: item.createdAt }));
    return res.status(201).json(publicItem(item));
  } catch (error) { return next(error); }
});

app.post('/api/items/:id/sold', (req, res, next) => {
  try {
    const items = storage.readItems();
    const item = items.find(entry => entry.id === req.params.id);
    if (!item) return fail(res, 404, 'ITEM_NOT_FOUND', 'That listing could not be found.');
    if (!item.sold) {
      item.sold = true; storage.saveItems(items);
      console.info('listing_marked_sold', JSON.stringify({ id: item.id, at: new Date().toISOString() }));
    }
    return res.status(200).json({ ok: true, item: publicItem(item) });
  } catch (error) { return next(error); }
});

app.post('/api/assistant', (req, res, next) => {
  try {
    if (!isPlainObject(req.body) || typeof req.body.message !== 'string')
      return fail(res, 400, 'INVALID_ASSISTANT_MESSAGE', 'Send a JSON object with a message string.');
    const message = req.body.message.trim();
    if (!message) return fail(res, 400, 'INVALID_ASSISTANT_MESSAGE', 'Please enter a message for the assistant.');
    if (message.length > 1000) return fail(res, 400, 'MESSAGE_TOO_LONG', 'Assistant messages must be 1,000 characters or fewer.');
    const answer = answerMessage(message, storage.readItems());
    console.info('assistant_request', JSON.stringify({ intent: answer.type, recommendations: answer.items.length, at: new Date().toISOString() }));
    return res.status(200).json(answer);
  } catch (error) { return next(error); }
});

app.post('/api/feedback', (req, res, next) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) return fail(res, 400, 'INVALID_FEEDBACK', 'Send a JSON object with feedback details.');
    let rating;
    if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return fail(res, 400, 'INVALID_RATING', 'Rating must be a whole number from 1 to 5.');
      rating = body.rating;
    }
    if (typeof body.category !== 'string' || !FEEDBACK_CATEGORIES.includes(body.category.trim()))
      return fail(res, 400, 'INVALID_FEEDBACK_CATEGORY', 'Choose Suggestion, Bug report, Usability, or Other.');
    if (typeof body.message !== 'string' || !body.message.trim()) return fail(res, 400, 'INVALID_FEEDBACK_MESSAGE', 'Please enter a feedback message.');
    if (body.message.length > 1000) return fail(res, 400, 'FEEDBACK_TOO_LONG', 'Feedback must be 1,000 characters or fewer.');
    const feedback = { id: crypto.randomUUID(), rating, category: body.category.trim(), message: body.message.trim(), createdAt: new Date().toISOString() };
    storage.addFeedback(feedback);
    console.info('feedback_saved', JSON.stringify({ id: feedback.id, category: feedback.category, hasRating: rating !== undefined, at: feedback.createdAt }));
    return res.status(201).json({ ok: true, message: 'Feedback saved. Thank you.' });
  } catch (error) { return next(error); }
});

app.use(express.static(path.join(__dirname, 'public'), { fallthrough: true, index: 'index.html' }));
app.use((req, res) => fail(res, 404, 'ROUTE_NOT_FOUND', 'Route not found. Check the URL and HTTP method.'));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error && error.type === 'entity.too.large') return fail(res, 413, 'BODY_TOO_LARGE', 'Request body exceeds the 100 KB limit.');
  if (error && error.type === 'entity.parse.failed') return fail(res, 400, 'MALFORMED_JSON', 'Request body is not valid JSON. Correct the JSON and try again.');
  if (error instanceof StorageError) {
    const feedbackFailure = error.code && error.code.startsWith('FEEDBACK_');
    const code = feedbackFailure ? error.code : error.code === 'STORAGE_CORRUPT' ? 'STORAGE_CORRUPT' : 'STORAGE_UNAVAILABLE';
    console.error('storage_error', JSON.stringify({ code, pathRole: feedbackFailure ? 'feedback' : 'items' }));
    return fail(res, 503, code, feedbackFailure ? 'Feedback could not be saved or read. Please try again later.' : 'Listing data is temporarily unavailable. Please try again later.');
  }
  if (error && error.status && error.code) return fail(res, error.status, error.code, error.message || 'The request could not be processed.');
  console.error('unexpected_request_error', JSON.stringify({ method: req.method, route: req.path, name: error?.name || 'Error' }));
  return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected server error occurred. Please retry.');
});

try { storage.initialize(); console.info('storage_initialized', JSON.stringify({ itemsReady: true, feedbackReady: true })); }
catch (error) { console.error('storage_initialization_failed', JSON.stringify({ code: error instanceof StorageError ? error.code : 'STORAGE_UNAVAILABLE' })); }

if (require.main === module) app.listen(PORT, () => console.info('CampusCycle listening on port ' + PORT));
module.exports = { app, storage, rateLimit, publicItem, PORT };
