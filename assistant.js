'use strict';

const CATEGORIES = [
  'Books & Study Materials', 'Electronics', 'Calculators', 'Cycles & Transport',
  'Hostel Essentials', 'Clothing & Accessories', 'Sports Equipment', 'Project Materials', 'Other'
];
const CONDITIONS = ['New', 'Like New', 'Good', 'Used'];
const CATEGORY_TERMS = [
  { category: 'Calculators', terms: ['scientific calculator', 'calculator', 'calculators'], specific: ['scientific calculator', 'calculator'] },
  { category: 'Books & Study Materials', terms: ['books & study materials', 'books', 'book', 'textbooks', 'textbook', 'study materials', 'study material', 'study books', 'notes', 'notebook', 'notebooks'], specific: ['textbooks', 'textbook', 'study materials', 'study material', 'study books', 'notes', 'notebook', 'notebooks', 'book', 'books'] },
  { category: 'Electronics', terms: ['electronics', 'laptop', 'laptops', 'headphones', 'headphone', 'earphones', 'earphone', 'smartphone', 'phone', 'tablet', 'monitor', 'keyboard', 'mouse', 'charger', 'speaker', 'power bank'], specific: ['laptop', 'laptops', 'headphones', 'headphone', 'earphones', 'earphone', 'smartphone', 'phone', 'tablet', 'monitor', 'keyboard', 'mouse', 'charger', 'speaker', 'power bank'] },
  { category: 'Cycles & Transport', terms: ['cycles & transport', 'cycle', 'cycles', 'bicycle', 'bicycles', 'bike', 'bikes', 'helmet', 'transport'], specific: ['cycle', 'cycles', 'bicycle', 'bicycles', 'bike', 'bikes', 'helmet'] },
  { category: 'Hostel Essentials', terms: ['hostel essentials', 'hostel', 'pillow', 'bucket', 'mattress', 'bedsheet', 'bed sheet', 'mug', 'laundry basket', 'room essentials', 'hostel room'], specific: ['hostel', 'pillow', 'bucket', 'mattress', 'bedsheet', 'bed sheet', 'mug', 'laundry basket', 'room essentials', 'hostel room'] },
  { category: 'Clothing & Accessories', terms: ['clothing & accessories', 'clothing', 'clothes', 'shirt', 'shirts', 'jeans', 'jacket', 'shoes', 'bag', 'watch', 'accessories'], specific: ['clothes', 'shirt', 'shirts', 'jeans', 'jacket', 'shoes', 'bag', 'watch', 'accessories'] },
  { category: 'Sports Equipment', terms: ['sports equipment', 'sports gear', 'badminton racket', 'racket', 'cricket bat', 'football', 'basketball', 'sports'], specific: ['badminton racket', 'racket', 'cricket bat', 'football', 'basketball', 'sports gear'] },
  { category: 'Project Materials', terms: ['project materials', 'arduino', 'sensor', 'breadboard', 'jumper wires', 'resistor', 'microcontroller', 'project components', 'components', 'electronics project'], specific: ['arduino', 'sensor', 'breadboard', 'jumper wires', 'resistor', 'microcontroller', 'project components', 'components', 'electronics project'] },
  { category: 'Other', terms: ['other'], specific: [] }
];

const FAQ_ANSWERS = [
  { keys: [/what is campuscycle|about campuscycle|what does campuscycle do/], answer: 'CampusCycle is a student-focused marketplace for browsing and listing pre-owned student essentials. It does not process payments.' },
  { keys: [/who can use|who is it for|eligible to use|can anyone use/], answer: 'CampusCycle is designed for college students, university students and hostel residents. The first version does not verify student identities.' },
  { keys: [/how (?:do i|can i) (?:search|find|browse)|search (?:for )?(?:items|products)|browse (?:items|products)/], answer: 'Use the search field and filters on the Browse section. Search checks listing titles and descriptions; filters can narrow category, budget, condition, college and location.' },
  { keys: [/how (?:do|can) (?:the )?filters? work|filter(?:s|ing)? work/], answer: 'Filters combine together. Set the category, minimum or maximum price, condition, college or location, then clear filters to return to all available listings.' },
  { keys: [/how (?:do i|can i) sell|sell (?:an? )?item|create (?:a )?listing|list (?:an? )?item/], answer: 'Open Sell an Item, complete the required title, price and seller contact fields, add the item details, then submit. The listing is stored by the backend and appears in Browse when saving succeeds.' },
  { keys: [/contact (?:a |the )?seller|seller contact|how (?:do i|can i) contact/], answer: 'Open a listing’s details to see the contact information supplied by the seller. Verify the item and agree on a safe meeting and payment method directly.' },
  { keys: [/mark (?:an? )?item as sold|mark.*sold|item.*sold/], answer: 'Open the listing details and select Mark as Sold. Confirm the action. The backend marks it sold, and it no longer appears in active Browse results. This demo has no account-based ownership checks.' },
  { keys: [/pay online|online payment|process payments|payment processing|can i pay|payments?/], answer: 'No. CampusCycle does not collect payments or provide escrow. Buyers and sellers arrange transactions independently; do not send advance payments to someone you have not verified.' },
  { keys: [/safe(?:ty)? (?:tips|when buying|buying used)|avoid scams|stay safe|is it safe to buy/], answer: 'Meet in a public place, inspect and test the item before paying, compare its condition with the description, protect your personal information, and avoid advance payments. CampusCycle does not guarantee sellers or transactions.' },
  { keys: [/verified students?|student verification|are students verified|verify.*student/], answer: 'No. Student identity or college affiliation is not verified in this initial version. Treat listing details as seller-provided information.' },
  { keys: [/why.*listing.*disappear|listing disappear|missing listing|where.*listing/], answer: 'Sold items are intentionally removed from active results. A listing may also be missing because your filters exclude it or the service cannot read its data. Clear filters and try again.' },
  { keys: [/incorrect listing|wrong information|report.*listing|listing information|listing.*wrong/], answer: 'Contact the seller to clarify an incorrect detail. The first version has no moderation or reporting workflow, so do not rely on the listing until you have verified it independently.' },
  { keys: [/feedback|send feedback|report a problem/], answer: 'Use the Feedback section to optionally choose a rating and category and leave a short message. A success notice appears only after the backend confirms it has saved.' }
];

function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function escapeRegExp(value) { return value.replace(/[.*+?^\$\{\}()|[\]\\]/g, '\\$&'); }
function includesTerm(message, term) {
  const phrase = normalize(term);
  if (!phrase) return false;
  if (phrase.includes(' ')) return message.includes(phrase);
  return new RegExp('(?:^|[^a-z0-9])' + escapeRegExp(phrase) + '(?:$|[^a-z0-9])', 'i').test(message);
}
function parseAmount(value) {
  const number = Number(String(value).replace(/[₹,\s]/g, '').replace(/^(?:rs\.?|inr)/i, ''));
  return Number.isFinite(number) ? number : null;
}
function parseBudget(message) {
  const between = message.match(/\bbetween\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+)\s*(?:and|to|[-–])\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+)/i)
    || message.match(/\b(?:budget(?: of)?\s+)?(?:₹|rs\.?\s*|inr\s*)([\d,]+)\s*(?:to|and|[-–])\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+)/i);
  if (between) {
    const a = parseAmount(between[1]); const b = parseAmount(between[2]);
    return a === null || b === null ? {} : { minPrice: Math.min(a, b), maxPrice: Math.max(a, b), found: true };
  }
  const max = message.match(/\b(?:under|below|less than|no more than|up to|upto|within|maximum|max(?:imum)?(?: budget)?|budget under|budget below)\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+)/i);
  if (max) { const value = parseAmount(max[1]); return value === null ? {} : { maxPrice: value, found: true }; }
  const min = message.match(/\b(?:over|above|more than|at least|minimum|min(?:imum)?(?: budget)?)\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+)/i);
  if (min) { const value = parseAmount(min[1]); return value === null ? {} : { minPrice: value, found: true }; }
  return {};
}
function detectCondition(message) {
  if (/\b(?:like new|almost new|brand new|new condition|condition is new)\b/.test(message)) return 'Like New';
  if (/\b(?:used|pre-owned|secondhand|second hand|preloved|pre-loved)\b/.test(message)) return 'Used';
  if (/\b(?:good condition|condition is good)\b/.test(message)) return 'Good';
  if (/\b(?:new|unused)\b/.test(message)) return 'New';
  return '';
}
function detectCategory(message) {
  const hits = [];
  for (const group of CATEGORY_TERMS) for (const term of group.terms) {
    if (includesTerm(message, term)) hits.push({ category: group.category, term, specific: group.specific.includes(term) });
  }
  hits.sort((a, b) => b.term.length - a.term.length || Number(b.specific) - Number(a.specific));
  if (!hits.length) return { category: '', categories: [], terms: [], specific: [] };
  return {
    category: hits[0].category,
    categories: [...new Set(hits.map(hit => hit.category))],
    terms: hits.filter(h => h.category === hits[0].category).map(h => h.term),
    specific: hits.filter(h => h.category === hits[0].category && h.specific).map(h => h.term)
  };
}
function detectPlace(message, items) {
  const candidates = new Map();
  for (const item of items) for (const [field, value] of [['college', item.college], ['location', item.location]]) {
    const place = normalize(value);
    if (place && place.length >= 3 && message.includes(place)) candidates.set(field + ':' + place, { field, value });
  }
  return [...candidates.values()].sort((a, b) => b.value.length - a.value.length)[0] || null;
}
function pickFAQ(message) {
  for (const entry of FAQ_ANSWERS) if (entry.keys.some(regex => regex.test(message))) return entry.answer;
  return null;
}
function publicItem(item) {
  return { id: item.id, title: item.title, price: item.price, category: item.category, condition: item.condition, description: item.description, location: item.location, college: item.college, createdAt: item.createdAt, sold: false };
}

function answerMessage(rawMessage, allItems) {
  if (typeof rawMessage !== 'string' || !rawMessage.trim()) return {
    type: 'clarification', message: 'Send a question or describe what you want to find.', items: [],
    suggestions: ['Find books under ₹300', 'Show calculators', 'How do I sell an item?']
  };
  const message = normalize(rawMessage).replace(/[’']/g, "'");
  const available = Array.isArray(allItems) ? allItems.filter(item => item && item.sold !== true) : null;
  if (!available) throw new TypeError('Listing data is unavailable');
  if (/^(?:hi|hello|hey|hiya|namaste|good morning|good afternoon|good evening)[!. ]*$/.test(message)) return {
    type: 'greeting', message: 'Hi! I’m the CampusCycle assistant. Tell me the item or category you need and your budget, and I’ll search current available listings.',
    items: [], suggestions: ['Find books below ₹300', 'Find a calculator under ₹700', 'What can I buy for my hostel?']
  };
  const faq = pickFAQ(message);
  if (faq && !/what can i buy|find|show|recommend|look for|search for/.test(message)) return {
    type: 'faq', message: faq, items: [], suggestions: ['Find items under ₹500', 'Browse all categories', 'How do I sell an item?']
  };

  const budget = parseBudget(message);
  const { category, categories, specific } = detectCategory(message);
  const condition = detectCondition(message);
  const place = detectPlace(message, available);
  const generalBrowse = /\b(?:show|browse|find|list|recommend|available|all items|all products|what can i buy|what is available)\b/.test(message);
  const cheap = /\b(?:cheap|cheapest|affordable|budget friendly|low cost|low-cost)\b/.test(message);
  const hostelIntent = /\b(?:hostel|hostel room|room essentials|dorm)\b/.test(message);

  if (categories.length > 1 && /\b(?:and|or|versus|vs)\b/.test(message)) {
    const choices = categories.slice(0, 3);
    return { type: 'clarification', message: 'I spotted more than one category (' + choices.join(', ') + '). Which one should I search first?', items: [],
      suggestions: choices.map(value => 'Find ' + value.toLowerCase()).concat('Show all available items').slice(0, 3) };
  }
  if (budget.found !== true && category && /\b\d{2,}(?:,\d{3})*(?:\.\d{1,2})?\b/.test(message)) return {
    type: 'clarification', message: 'I spotted a number, but it is not clear whether it is your budget. Should I treat it as a maximum price, minimum price, or a price range?', items: [],
    suggestions: ['Under ₹700', 'Above ₹500', 'Between ₹500 and ₹1,500']
  };
  if (hostelIntent && !category) return buildRecommendations({ available, category: 'Hostel Essentials', specific: [], budget, condition, place, cheap, originalMessage: message });
  if (category || budget.found || condition || place || cheap || generalBrowse) {
    if (!category && !budget.found && !condition && !place && !cheap && generalBrowse && !/all items|all products|browse all|show all/.test(message)) return {
      type: 'clarification', message: 'What kind of item are you looking for? Add a product or category, and a budget such as “under ₹700” if you have one.', items: [],
      suggestions: ['Find books below ₹300', 'Find a calculator under ₹700', 'Show hostel essentials']
    };
    return buildRecommendations({ available, category, specific, budget, condition, place, cheap, originalMessage: message });
  }
  return {
    type: 'unsupported',
    message: 'I can help search actual CampusCycle listings, compare options by budget, explain marketplace features, and give safe-buying guidance. I cannot answer unrelated questions or contact sellers for you.',
    items: [], suggestions: ['Find a calculator under ₹700', 'Show electronics between ₹500 and ₹1,500', 'How can I stay safe when buying?']
  };
}

function buildRecommendations({ available, category, specific, budget, condition, place, cheap }) {
  let matches = available.filter(item => {
    if (category && item.category !== category) return false;
    if (budget.minPrice !== undefined && item.price < budget.minPrice) return false;
    if (budget.maxPrice !== undefined && item.price > budget.maxPrice) return false;
    if (condition && normalize(item.condition) !== normalize(condition)) return false;
    if (place && normalize(item[place.field]) !== normalize(place.value)) return false;
    if (specific && specific.length) {
      const haystack = normalize(item.title + ' ' + item.description + ' ' + item.category);
      const requested = specific.some(term => {
        const variants = term === 'calculator' ? ['calculator', 'calculators'] : term === 'cycle' ? ['cycle', 'bicycle', 'bike'] : term === 'book' ? ['book', 'books', 'textbook', 'textbooks'] : [term];
        return variants.some(v => includesTerm(haystack, v));
      });
      if (!requested) return false;
    }
    return true;
  });
  const rank = item => {
    const haystack = normalize(item.title + ' ' + item.description);
    let score = 0;
    for (const term of (specific || [])) if (includesTerm(haystack, term)) score += 10 + term.length / 10;
    if (category && item.category === category) score += 8;
    if (condition && normalize(item.condition) === normalize(condition)) score += 4;
    if (place && normalize(item[place.field]) === normalize(place.value)) score += 5;
    return score;
  };
  matches.sort((a, b) => rank(b) - rank(a) || (cheap ? a.price - b.price : b.createdAt.localeCompare(a.createdAt)));
  const shown = matches.slice(0, 5).map(item => {
    const reasons = [];
    if (category && item.category === category) reasons.push('category: ' + category);
    if (specific && specific.some(term => includesTerm(normalize(item.title + ' ' + item.description), term))) reasons.push('matches your product keywords');
    if (budget.minPrice !== undefined || budget.maxPrice !== undefined) reasons.push('within your budget');
    if (condition && normalize(item.condition) === normalize(condition)) reasons.push(condition.toLowerCase() + ' condition');
    if (place && normalize(item[place.field]) === normalize(place.value)) reasons.push('matches your ' + place.field);
    if (!reasons.length) reasons.push('currently available and unsold');
    return { ...publicItem(item), reason: 'Matches ' + reasons.join(', ') + '; listed at ₹' + item.price.toLocaleString('en-IN') + '.' };
  });
  const budgetText = budget.minPrice !== undefined && budget.maxPrice !== undefined
    ? 'between ₹' + budget.minPrice.toLocaleString('en-IN') + ' and ₹' + budget.maxPrice.toLocaleString('en-IN')
    : budget.maxPrice !== undefined ? 'up to ₹' + budget.maxPrice.toLocaleString('en-IN')
      : budget.minPrice !== undefined ? 'from ₹' + budget.minPrice.toLocaleString('en-IN') : '';
  const constraints = [category, condition ? condition.toLowerCase() + ' condition' : '', budgetText, place ? (place.field === 'college' ? 'college' : 'location') + ': ' + place.value : ''].filter(Boolean);
  const responseMessage = shown.length
    ? 'I found ' + matches.length + ' available ' + (matches.length === 1 ? 'listing' : 'listings') + (constraints.length ? ' matching ' + constraints.join(', ') : '') + '. ' + (cheap ? 'Lower-priced options are ranked first. ' : '') + 'Open a result to see the full details and seller contact.'
    : 'I couldn’t find an available listing' + (constraints.length ? ' matching ' + constraints.join(', ') : '') + '. No products have been invented. Try a wider budget, another condition, or a different category.';
  return {
    type: 'recommendations', message: responseMessage, items: shown,
    suggestions: shown.length ? ['Show cheaper options', 'Change category', 'How do I contact a seller?'] : ['Remove one filter', 'Show all available items', 'How can I sell an item?']
  };
}
module.exports = { CATEGORIES, CONDITIONS, answerMessage, parseBudget, detectCategory, detectCondition, detectPlace, normalize, FAQ_ANSWERS };
