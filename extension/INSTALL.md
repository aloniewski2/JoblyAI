# JoblyAI Browser Extension

## Install in Chrome (takes 30 seconds)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Pin the extension from the puzzle-piece icon in Chrome's toolbar

## How to use

1. Browse to any job posting (Greenhouse, Lever, Workday, company career pages, LinkedIn, Indeed, etc.)
2. Click the JoblyAI icon in your toolbar
3. The popup auto-extracts company, title, location, and salary
4. Confirm or edit the fields, then click **Save to JoblyAI**
5. Click **Open in JoblyAI** to view the saved application

## Supported sites

| Site | Extraction quality |
|------|-------------------|
| Greenhouse (boards.greenhouse.io) | Excellent — full JD via JSON-LD |
| Lever (jobs.lever.co) | Excellent — full JD via JSON-LD |
| Ashby (jobs.ashbyhq.com) | Excellent — full JD via JSON-LD |
| SmartRecruiters | Excellent |
| Workday | Good — title + description |
| Company career pages | Good — if they use structured data |
| LinkedIn | Good — DOM extraction (must be logged in) |
| Indeed | Good — DOM extraction |
| Generic pages | Basic — title + company from meta tags |

## Paste fallback

For any site where auto-extraction is limited, the popup shows a paste area. Paste the job description text and click **Extract & Fill Form** — the AI on your local server will extract the structured data.

## Settings

Click the gear icon in the popup to change the server URL if you're running JoblyAI on a non-default port or a deployed URL.

## Firefox

Firefox support: go to `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`.
