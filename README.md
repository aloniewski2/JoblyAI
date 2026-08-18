# JoblyAI

A job-search tracker that keeps applications, resumes, and contacts in one place —
with a browser extension that saves a posting in one click and an AI layer that reads
the job description so you don't have to retype it.

Built while job hunting, which is why the parts that exist are the parts that actually
get used daily.

## What it does

- **Track applications** through their stages — list view, Kanban board, and a "Today"
  view for what needs attention now.
- **Save any posting in one click** with the Chrome extension. It scrapes the page and
  sends it to the tracker rather than making you copy fields across.
- **Pull structure out of a job description** with an LLM: title, company, and
  requirements from pasted or scraped text.
- **Match a resume against a posting** and keep multiple resume versions per role.
- **Track contacts** and the connections attached to each application.
- **Watch Gmail read-only** for replies, so status changes don't depend on memory.
- **Analytics** across the whole search — where applications stall, what converts.

## Stack

| Part | Built with |
| --- | --- |
| `client/` | React 18, TypeScript, Vite, Tailwind, TanStack Query, dnd-kit (Kanban), React Router |
| `server/` | Express, better-sqlite3, Google APIs (Gmail), cheerio (scraping), pdf-parse + mammoth (resume parsing) |
| `extension/` | Chrome Manifest V3 — popup, content script, `activeTab` + `scripting` |
| AI | Any OpenAI-compatible endpoint — Groq or a local Ollama model |

SQLite means there's no database to provision: the file is the database.

## Running it

```bash
npm run setup     # installs client and server dependencies
npm run seed      # optional — sample applications to click around
npm run dev       # client and server together
```

The client comes up on Vite's dev port and the server on `3001`.

### Configuration

Copy `.env.example` to `server/.env`. Everything in it is optional — the tracker works
without any keys, and each key switches on one feature:

| Variable | Enables |
| --- | --- |
| `GROQ_API_KEY` | AI extraction and resume matching (free tier; no card) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | read-only Gmail reply tracking |

With no key set, the AI layer falls back to a local **Ollama** model if one is running,
so the feature can be demoed with nothing hosted and nothing paid for.

### The extension

```
chrome://extensions → Developer mode → Load unpacked → select extension/
```

See `extension/INSTALL.md`. It talks to the server on `localhost:3001`, so start the
server first.

## Status

Working and used, but self-hosted — there's no deployed instance yet. The server assumes
a single local user: no auth, and SQLite on disk.
