'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class StorageError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }
}

function parseArray(filePath, code) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new StorageError(code, error);
  }
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new TypeError('Expected a JSON array');
    return value;
  } catch (error) {
    throw new StorageError(code.startsWith('FEEDBACK_') ? 'FEEDBACK_STORAGE_CORRUPT' : 'STORAGE_CORRUPT', error);
  }
}

function writeArrayAtomically(filePath, value, code) {
  const temporary = filePath + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {
      encoding: 'utf8', flag: 'wx', mode: 0o600
    });
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* Best-effort temporary-file cleanup. */ }
    throw new StorageError(code, error);
  }
}

function initializeArray(filePath, errorCode) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    try {
      const descriptor = fs.openSync(filePath, 'wx', 0o600);
      try { fs.writeFileSync(descriptor, '[]\n', 'utf8'); } finally { fs.closeSync(descriptor); }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  } catch (error) {
    throw new StorageError(errorCode, error);
  }
}

function createStorage(options = {}) {
  const defaultItems = path.resolve(process.cwd(), 'data', 'items.json');
  const itemsPath = path.resolve(options.itemsFile || process.env.DATA_FILE || defaultItems);
  const feedbackPath = path.resolve(options.feedbackFile || process.env.FEEDBACK_FILE || path.join(path.dirname(itemsPath), 'feedback.json'));
  function initialize() {
    initializeArray(itemsPath, 'STORAGE_UNAVAILABLE');
    initializeArray(feedbackPath, 'FEEDBACK_STORAGE_UNAVAILABLE');
  }
  function readItems() { return parseArray(itemsPath, 'STORAGE_UNAVAILABLE'); }
  function saveItems(items) { writeArrayAtomically(itemsPath, items, 'STORAGE_UNAVAILABLE'); }
  function readFeedback() { return parseArray(feedbackPath, 'FEEDBACK_STORAGE_UNAVAILABLE'); }
  function saveFeedback(feedback) { writeArrayAtomically(feedbackPath, feedback, 'FEEDBACK_STORAGE_UNAVAILABLE'); }
  function addFeedback(entry) {
    const current = readFeedback();
    current.unshift(entry);
    saveFeedback(current);
    return entry;
  }
  return { itemsPath, feedbackPath, initialize, readItems, saveItems, readFeedback, saveFeedback, addFeedback };
}

module.exports = { createStorage, StorageError, parseArray, writeArrayAtomically };
