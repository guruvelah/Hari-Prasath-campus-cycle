Live website: https://campuscycle-2jcd.onrender.com

# CampusCycle — Student Marketplace with AI Assistant

**Tagline:** Your Campus. Your Marketplace.

CampusCycle is a student-focused secondhand marketplace for affordable pre-owned items. It uses Node.js, Express, HTML, CSS, vanilla JavaScript and JSON-file storage. Its rule-based assistant uses deterministic keyword matching and actual listings. It requires NO AI API key, makes no external AI-service call, and is not a generative language model.

**GitHub:** https://github.com/guruvelah/Hari-Prasath-campus-cycle  
**Live HTTPS URL:** https://campuscycle-2jcd.onrender.com

## Problem and objectives

Students need affordable textbooks, calculators, electronics, cycles, hostel supplies, sports equipment and project components. Other students have usable items they no longer need. CampusCycle helps buyers discover listings and contact sellers directly.

Objectives:
- Browse, search and filter student-focused listings.
- Create/view a listing and mark it sold.
- Provide FAQ answers and rule-based recommendations from live listing data.
- Validate inputs, return consistent JSON errors and persist listings and feedback.
- Provide health checks, logging and baseline security controls.

## Technology

- Node.js 18 or later
- Express.js dependency version ^4.19.2
- HTML, CSS and vanilla JavaScript
- JSON files; no database or native dependencies
- GitHub source repository and Render Free Node Web Service as deployment target
- No React, Next.js, MongoDB, payment processing, paid AI provider or API key

## Features

- Responsive green-and-light marketplace UI designed for mobile widths.
- Search by title and description; category, minimum/maximum price, condition, college and location filters; newest-first results.
- Details include price, description, condition, location, college, creation date and seller contact.
- Listing creation with server-side validation and a confirmation before Mark as Sold.
- Twelve expandable FAQ entries.
- Rule-based assistant with natural-language-style queries, suggested follow-ups and clickable actual listing recommendations.
- Feedback with optional rating, category and message; success is reported only after storage succeeds.
- Structured JSON errors, 100 KB request limit, process-local rate limits, security headers, health check and concise logging.

## Architecture

Browser UI at public/index.html sends same-origin JSON requests to server.js. Routes expose health, categories, item listing/details, creation, sold status, assistant and feedback. assistant.js performs deterministic local matching. storage.js stores JSON in data/items.json and data/feedback.json.

## Folder structure

    Hari-Prasath-campus-cycle/
    ├── package.json
    ├── server.js
    ├── assistant.js
    ├── storage.js
    ├── README.md
    ├── .gitignore
    ├── public/index.html
    ├── test/smoke.test.js
    └── data/  (created automatically; ignored by Git)

PORT comes from the environment and defaults to 3000. Listing storage uses DATA_FILE when configured, otherwise ./data/items.json relative to the working directory. FEEDBACK_FILE optionally overrides feedback storage; otherwise feedback.json is beside the item file. Missing JSON files initialise as empty arrays. Corrupt storage is reported rather than silently reset. Writes use a temporary file and rename.

JSON files are appropriate for a small student demonstration, not robust multi-instance transactions or durable cloud storage. Render free instances can sleep and local filesystem data may not survive a redeploy or restart.

## Installation and local setup

Requirements: Node.js 18+ and npm.

    npm install
    npm test
    npm start

Open http://localhost:3000. Do not deploy if dependency installation or the test command fails. Inspect the full terminal output and fix the underlying problem before continuing.

## API reference

All API request/response bodies are JSON. Request parsing is limited to 100 KB.

| Method and route | Purpose | Success |
|---|---|---|
| GET /health | Checks both JSON stores can be read | 200 with status ok |
| GET /api/categories | Returns the nine supported categories | 200 |
| GET /api/items | Lists unsold items newest first | 200 |
| GET /api/items/:id | Returns one listing, including sold status | 200 |
| POST /api/items | Validates and creates an item | 201 |
| POST /api/items/:id/sold | Marks an item as sold | 200 |
| POST /api/assistant | Searches actual listings using local deterministic rules | 200 |
| POST /api/feedback | Validates and persists feedback | 201 |

### Item filters

GET /api/items supports q, category, minPrice, maxPrice, condition, college and location. Filters combine together. Search checks title and description. Price filters must be non-negative numeric strings and minimum price cannot exceed maximum. Supported conditions are New, Like New, Good and Used. Sold listings are excluded from browse results.

### Listing input

    {
      "title": "Scientific calculator",
      "price": 650,
      "category": "Calculators",
      "condition": "Good",
      "description": "Fully working calculator with cover.",
      "location": "Coimbatore",
      "college": "Example College",
      "contact": "seller contact supplied by the user"
    }

The server generates ID, timestamp and sold=false; client-supplied IDs, timestamps or sold flags are not trusted. Title is required, maximum 80 characters. Price must be finite and at least zero. Invalid/missing category becomes Other. Missing condition defaults to Good; when supplied it must be New, Like New, Good or Used. Description maximum 1,000 characters, location 80, college 120 and contact 80. Title and contact must not be blank.

### Assistant and feedback request formats

Send POST /api/assistant with a JSON object containing a message string, for example: Find a calculator under 700. The response contains type, message, actual matched items and suggested follow-up prompts. Ambiguous requests ask for clarification; no-match requests do not invent products.

POST /api/feedback accepts optional integer rating from 1 to 5, category Suggestion / Bug report / Usability / Other, and a required message of at most 1,000 characters. Success is only reported after the write succeeds.

## Error codes and troubleshooting

Error response format:

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Title is required."
      }
    }

| HTTP | Application error code examples | Meaning | Resolution |
|---|---|---|---|
| 200 | Success (implicit) | Request completed | Use the returned data |
| 201 | Creation success (implicit) | Listing or feedback saved | Use the returned result |
| 400 | VALIDATION_ERROR, INVALID_PRICE, INVALID_CONDITION | Missing/invalid fields | Correct the request values |
| 400 | MALFORMED_JSON | Body is not valid JSON | Send valid JSON with Content-Type |
| 400 | INVALID_QUERY, INVALID_PRICE_FILTER, INVALID_PRICE_RANGE | Invalid filter values | Use supported filter values and non-negative prices |
| 403 | CORS_ORIGIN_DENIED | Browser request from an unapproved origin | Use the same-origin app URL |
| 404 | ITEM_NOT_FOUND | Listing ID not found | Refresh; it may no longer exist |
| 404 | ROUTE_NOT_FOUND | Unknown path or method | Check API path and HTTP method |
| 413 | BODY_TOO_LARGE | Request exceeds 100 KB | Reduce the body size |
| 429 | RATE_LIMIT_EXCEEDED, ASSISTANT_RATE_LIMITED, FEEDBACK_RATE_LIMITED | Process-local request limit reached | Wait and retry |
| 500 | INTERNAL_SERVER_ERROR | Unexpected failure | Inspect server logs and correct the root cause |
| 503 | STORAGE_UNAVAILABLE, STORAGE_CORRUPT, FEEDBACK_STORAGE_UNAVAILABLE | Storage unreadable, unwritable or corrupt | Inspect file permissions/data; preserve a copy before any repair |

The centralized handler controls malformed and oversized JSON, unknown routes, missing item IDs, storage errors and unexpected exceptions. It does not send stack traces or filesystem paths to clients. Rate limits are process-local and are not a durable or distributed abuse-prevention system.

Troubleshooting workflow:
1. Reproduce the issue using the same route, method and synthetic request.
2. Check the browser Network panel for the HTTP status and JSON response.
3. Repeat the request locally and inspect server logs for event names and error codes.
4. Identify whether the cause is validation, routing, assistant parsing or JSON storage.
5. Make a minimal fix, run npm test, then repeat the failing request.
6. For live failures, inspect Render logs and GET /health. Do not claim a fix passed until it is retested.

## Rule-based assistant architecture

The assistant is deterministic and not an LLM. It makes no external network requests. assistant.js normalises the query, recognises category names and synonyms, extracts common rupee-budget phrases, detects condition and known locations/colleges, handles greeting/FAQ/unsupported intents, then searches the current unsold JSON listings. It ranks matches deterministically and explains why they match.

Example supported prompts:
- Find a calculator under 700
- Show books below ₹300
- Find bicycles under ₹2,000
- Show electronics between ₹500 and ₹1,500
- Find items in good condition
- What can I buy for my hostel?
- How can I sell my calculator?
- Can I pay online?
- What is CampusCycle?

Aliases include textbook/notes, scientific calculator, laptop/headphones, bicycle/bike, pillow/bucket, badminton racket, Arduino and sensor. It does not contact sellers, execute purchases, verify identity, use external live data or answer unrelated questions. Some ambiguous requests trigger clarification. Extend it by adding scoped aliases to CATEGORY_TERMS and regression tests for each new intent.

## Security and privacy

- express.json limit set to 100 KB.
- Server validation for data types, required values, field lengths, finite prices, conditions and feedback.
- User-controlled frontend text is placed into DOM nodes through textContent; user HTML/JavaScript is not executed.
- Security headers include nosniff, clickjacking protection, referrer policy, permissions policy and a restrictive Content Security Policy.
- Cross-origin browser requests are not allowed by wildcard; same-origin is the default.
- API, assistant and feedback rate limits are implemented in process.
- Logs avoid seller contact and feedback message content.
- .gitignore excludes node_modules/, .env, data/ and *.log.

There are no user accounts, secure listing ownership checks, student verification or moderation in this initial release. Anyone who can reach the service may be able to mark another person's listing sold. Seller contacts are visible to listing viewers. Do not publish sensitive data; inspect items and meet safely.

## Monitoring and feedback

GET /health checks both JSON stores can be read. Important events and errors are logged to process output. Feedback supports optional rating, category and message and saves to JSON before showing success. No external uptime-alert service or hosted monitoring is configured.

## Render deployment

Create a NEW Web Service. Do not delete or modify the existing Docker service in the original repository.

1. Push tested code to GitHub.
2. In Render choose New → Web Service; connect guruvelah/Hari-Prasath-campus-cycle and branch main.
3. Leave Root Directory blank.
4. Runtime: Node.
5. Build Command: npm install.
6. Start Command: npm start.
7. Instance Type: Free.
8. No AI API key or extra environment variable is needed for the assistant.
9. Copy the real HTTPS URL shown by Render and replace PENDING DEPLOYMENT above only after it is confirmed.
10. Test health, browse, creation, details, sold status, FAQ, assistant and feedback with synthetic data.

Render free instances may sleep and JSON files on ephemeral storage are not reliable permanent storage. Use durable database storage in a future version if persistent production data is required.

## Known limitations and proposed improvements

Known limitations: no accounts, verified student identity, owner-bound listing permissions, database, image upload, payment processing, messaging, moderation/reporting or external uptime alerts. JSON storage is not built for robust concurrent multi-instance access. The assistant is rule-based and limited to documented keywords/intents.

Proposed improvements:
- Student accounts and college-email verification.
- Secure listing ownership and seller-authorised sold status.
- MongoDB Atlas or another durable managed data store.
- Image uploads and campus-specific listing feeds.
- In-app messaging, listing reporting and moderation.
- More advanced recommendations while clearly disclosing any external AI dependency.

## Tests and evidence

Run npm install and npm test before deployment. Use synthetic data only, never real personal contact details. Check responsive layout at 375 px in a real browser. Static checks are not equivalent to interactive browser testing.

At the time this README is authored:
- Source has been committed to this repository.
- The project was previously tested locally using an Express-compatible test shim; that does not replace a clean npm install with real Express.
- Browser automation and Render live tests are not verified.
- Render reports the first deployment as LIVE at https://campuscycle-2jcd.onrender.com. Endpoint-by-endpoint live smoke tests remain NOT VERIFIED.

## Viva preparation

1. **What problem does CampusCycle solve?** Affordable discovery and resale of student essentials.
2. **What is Node.js?** A JavaScript runtime for the server.
3. **What is Express?** A Node framework for routes, middleware and HTTP responses.
4. **What is a REST API?** A standard way to interact with resources through HTTP methods and routes.
5. **Why JSON storage?** It keeps a small demo simple, but is limited for durable concurrent workloads.
6. **Why server-side validation?** Browser checks can be bypassed; the server protects stored data.
7. **How does search work?** Case-insensitive matching of title and description.
8. **How do filters combine?** Every selected filter is applied to the same unsold listing set.
9. **How is an item created?** The server validates fields, generates ID/date/sold status, and saves it.
10. **What does Mark as Sold do?** Saves the sold flag and excludes the listing from active browse results.
11. **Why error codes?** They identify validation, routing, rate-limiting and storage problems.
12. **Which security controls exist?** Validation, safe rendering, body limits, headers, restricted CORS and rate limiting.
13. **How is text rendered safely?** DOM nodes and textContent prevent user strings from becoming executable markup.
14. **What is the rule-based assistant?** Explicit keyword/regex logic that searches actual listing data without an AI provider.
15. **How does it differ from an LLM?** It uses defined rules, not a trained generative language model.
16. **How is a budget extracted?** Regex rules recognise under/below/between phrases and currency amounts.
17. **How are recommendations ranked?** Keyword, category, condition and place matches receive deterministic scores.
18. **Why does it require no API key?** Assistant logic runs locally in Node and sends no external AI request.
19. **What does /health verify?** It checks required JSON stores can be read.
20. **How do GitHub and Render work together?** GitHub stores source; Render builds and starts the chosen branch.
21. **What are free-tier limitations?** Sleep and ephemeral filesystem data can affect startup and persistence.
22. **What should be improved next?** Ownership, authentication, durable storage, moderation and more advanced recommendations.

## 12-item launch checklist

1. [ ] Website loads and branding is correct. — **NOT VERIFIED**
2. [ ] Browse, search, and filters work. — **NOT VERIFIED**
3. [ ] Listing creation and validation work. — **NOT VERIFIED in target repository**
4. [ ] Details view and Mark as Sold work. — **NOT VERIFIED in target repository**
5. [ ] FAQ is complete and functional. — **NOT VERIFIED in target repository**
6. [ ] AI assistant works without an API key. — **NOT VERIFIED in target repository**
7. [ ] Backend API and error handling work. — **NOT VERIFIED in target repository**
8. [ ] JSON storage and its limitations are documented. — **PASS**
9. [ ] Security checks and .gitignore are reviewed. — **NOT VERIFIED in target repository**
10. [ ] Monitoring, logging, and feedback work. — **NOT VERIFIED in target repository**
11. [ ] GitHub repository and README are updated. — **PASS**
12. [ ] Render deployment and live tests are verified. — **NOT VERIFIED** (Render deployment is LIVE; endpoint-by-endpoint checks remain pending).

## Submission status

- Individual task title: CampusCycle — Student Marketplace with AI Assistant
- Live website link (HTTPS): PENDING DEPLOYMENT
- GitHub repository: https://github.com/guruvelah/Hari-Prasath-campus-cycle
- Assistant: rule-based, no API key and no external AI dependency.
- Live deployment: Render reports status LIVE at https://campuscycle-2jcd.onrender.com. Live API/browser smoke test results: NOT VERIFIED.
- Old Docker service: not deleted or modified.
