# Career ops X Ai apply: the aiapply.co model

Research date: 2026-11-05. Source: aiapply.co public pages only (home, /auto-apply,
/llms.txt, the public site map). No account was made and nothing was entered.
Interview prep (Interview Buddy, AI Job Interview, mock interviews, question
generators) is **excluded** on purpose.

This file models aiapply's *abilities and flows*, not its brand. No logo, image
or marketing copy is reused. The experiment lives at `/x` in `web/`, on its own
branch (`claude/careerops-x-aiapply-b709af`), styled with Career Reef's `lux`
design system.

## 1. aiapply abilities and their user flows

| # | Ability | aiapply flow (as described publicly) |
|---|---------|--------------------------------------|
| 1 | Onboarding / setup | Short quiz: upload resume or LinkedIn, then pick target roles, locations, companies to include or avoid. A "setup status" tells the user what is still missing and the next step. |
| 2 | Job search and matching | Large aggregated job list, scanned daily. Each job gets a 0-100 fit score, a "why this is a good fit" line and a qualification checklist (met / not met). |
| 3 | Auto Apply | Matches are found continuously. For each one the resume and cover letter are tailored, then the application is either sent automatically or held in a **review queue** until the user approves it. Modes: manual, hybrid (review queue), full auto. Pause / resume at any time. |
| 4 | Application tracking | One place listing every application: where, when, status, and which resume version was used. |
| 5 | Resume builder / editor | Build an ATS-friendly resume from scratch or LinkedIn; AI edit suggestions ("make it less wordy"); role templates; translation. |
| 6 | Resume scoring (ATS scanner) | Score a resume against a job description: keyword gaps, ATS issues, improvement tips. |
| 7 | Cover letter generator | One click per job: letter matched to the JD from the resume. Cover letter checker. |
| 8 | Dashboard | Home shows matches, the review queue, applications sent and credits. |
| 9 | Free tools | Follow-up email, salary calculator, skills-gap, JD keyword finder, offer comparison, job tracker, networking email, etc. |
| 10 | Mailbox | Reads replies in a dedicated mailbox and surfaces unread recruiter mail. |
| — | Interview prep | Excluded. |

The core UX idea: **one profile, one queue, one button per job.** Everything
else is optional.

## 2. Map to career-ops and the gap

| Ability | What career-ops already has | Gap for Career ops X Ai apply |
|---------|-----------------------------|-------------------------------|
| Onboarding | `doctor.mjs` (`/api/doctor`), CV ingest (`/api/cv/ingest` + `/api/cv`), LinkedIn import, `/api/profile`, onboarding banner. Spread over several pages. | **3-step wizard** at `/x/start`: resume, what you want, done. A setup checklist on the home page reading `doctor.mjs`. |
| Job matching | `scan.mjs` + remote boards, evaluation reports (score 1-5, Block B CV match table, Machine Summary strengths/gaps), Reef Watch openings. | **Match cards**: score shown as /100, "why it fits", qualification checklist (✓/✗) parsed from Block B. Search + filters (remote, min score) on `/x/jobs`. |
| Auto Apply | Reef Watch queue, `docs-due.mjs` + queue-feeder task (auto-makes documents for 3.5+), Chrome extension Open & fill, sign-in alerts, Submit outlined not clicked. | **Apply queue** at `/x/queue` with aiapply's modes, made safe: *Review each* / *Auto-prepare* (documents made automatically, you approve). **Never auto-submit**: the last step is always Open & fill, then you press Submit. Prepare one or all with one click. |
| Tracking | Tracker (`data/applications.md`), `/pipeline`, `set-status.mjs` via `/api/status`, status log, Gmail applied-check. | **Simple board** at `/x/tracker`: columns by stage, one-click "Mark applied" / move, documents used per application. |
| Resume builder | `cv.md`, CV editor (`/cv`), CV Studio, pdf mode tailored CVs. | Entry point at `/x/resume`: the base resume plus every tailored version, with links into the existing editor. No new builder. |
| Resume scoring | `keyword-match.mjs` (`/api/keyword-match`), `verify-ats.mjs`. | **ATS score per job** shown on `/x/resume` (pick a job, see coverage % and missing keywords). |
| Cover letters | `cover` mode (`/api/run` kind `cover`), cover PDFs, `career-reef-cover-letter` skill. | One button per job on the job panel, with the cover brief prefilled from the evaluation for the user to edit. |
| Dashboard | `/reef` editorial overview, `/` home. | **`/x` home**: setup checklist, 4 numbers, the next 3 matches, the queue, recent applications. One primary action. |
| Free tools | followups, salary-gap, upskill, keyword-match, patterns, explore, portals. | **Tools hub** `/x/tools` linking to the existing pages. |
| Mailbox | Gmail applied-check task, reply-watch mode. | Linked from tools; no new mailbox. |

## 3. Build plan

1. `/x` route group in `web/` with its own sub-navigation (Home, Matches,
   Apply queue, Resume, Tracker, Tools) and "Career ops X Ai apply" title.
   Career Reef pages are untouched.
2. `lib/x-data.ts`: read-only view built on `readReefData()` plus Block B
   qualification rows and Machine Summary strengths/gaps from each report.
3. Pages: home, start (wizard), jobs (matches + detail panel), queue, resume,
   tracker, tools. Reuse `ApplyButton`, `GeneratePdfButton`, the `cover`
   worker, `/api/status`, `/api/keyword-match`, `/api/doctor`, `/api/profile`,
   `/api/cv/ingest`.
4. Run on port 3100 (`.claude/launch.json` entry `career-ops-x`) with `CAREER_OPS_ROOT=C:\career-ops` so it reads the real
   data; Career Reef on 3000 keeps running.
5. Verify each flow in the browser, then write the side-by-side comparison.

## 4. Safety rules kept

- Nothing submits an application. "Auto apply" means: documents prepared
  automatically, form opened and filled, Submit outlined. The user presses it.
- Local only, no paid services, no third-party analytics or CDNs.
- Writes go only through existing writers (`set-status.mjs`, `/api/profile`
  merge, `/api/cv` after confirm, workers).
- System-layer files edited on this branch (all under `web/`) could be
  overwritten by `update-system.mjs`; that is why this lives on its own branch.

## 5. Side by side: Career Reef (main, localhost:3000/reef) vs Career ops X Ai apply (this branch, localhost:3100/x)

Both were checked in the browser on 2026-11-05 against the same real data (27 evaluated
openings, 7 applied this week). Nothing was saved, generated or submitted during the checks.

| Flow | Career Reef | Career ops X Ai apply | Better |
|------|-------------|-----------------------|--------|
| First screen | Full-screen video hero ("Your next role, curated"); numbers and jobs start one scroll down. | Headline "8 jobs are ready to apply", a Review and apply button, then a setup checklist (hidden once done), 4 numbers and the top 3 matches. | X for getting to work; Reef for atmosphere. |
| Finding a job | 27 cards with fit /10 and tabs Apply-first / A closer look / Verify first; remote roles live in a separate Remote boards section. | The same 27 jobs with a match /100, a fit label, "why it fits" and a ✓/~/✗ checklist (e.g. Unit Manager: Contracts & Change Management at the Department of Water Resources: 4 met, 1 partly, "supervise, train and evaluate staff" not met). Search box, Remote only (9 jobs, e.g. Strategy & Operations Analyst at Datavant), Ready only, minimum score. | X. Reef's "Verify first" tab says more clearly which postings are unconfirmed; X shows a small "Verify open" tag instead. |
| Job details | Drawer with facts, why it fits, next step, verification, Open & fill, Generate CV, documents, with written instructions for the cover letter and SOQ. | Drawer with the full checklist, a Draft cover letter button inline, Generate CV, Open & fill, plus "I submitted it" and "Skip this job" (each with Undo). | X. Fewer trips to the pipeline page to record what you did. |
| Ready to apply | "Ready for review": the same 8 jobs (Department of Water Resources Unit Manager, County of Yolo Senior Administrative Services Analyst, City of Elk Grove Management Analyst I/II, Centene Project Manager II, Verra Mobility Project Manager, Datavant Strategy & Operations Analyst, Evio Contract Development Manager, Centene Program Manager IV), each with documents and Open & fill. | The same 8 jobs in the Ready lane, with Resume / Cover / SOQ dots showing which documents exist (7 of the 8 have no cover letter yet), Open & fill, I submitted it, Skip. | X, slightly: missing cover letters are visible at a glance. |
| Making documents | Generate CV one job at a time from the drawer. | "Needs documents" lane (19 jobs) with one button that tailors resumes for the next 3 jobs missing one; cover letter and SOQ from the drawer. | X. |
| Resume | Separate CV page (/cv). | One page: base resume summary, the 14 tailored versions, and an ATS keyword check against any job (e.g. 10% keyword coverage for the Department of Water Resources Unit Manager role, with the missing keywords listed). | X. |
| Tracking | "Your applications" list on the Reef and the full pipeline table. | Board: Applied (7) / In process / Offer / Closed, with "Resume sent", evaluation and posting links, and one-press moves (Responded, Interview, Rejected, Offer, Hired). | X for a glance; the pipeline table is still better for bulk edits. |
| Setup | Onboarding banner and separate pages. | 3-step wizard: resume import, job titles / salary floor and target / where you will work (only changed fields are written, with a backup), done. | X. |
| Scanner status | "Reef Watch, at work" status panel (scanner, evaluator, workers). | One small box: last scan (1182 found, 18 new) and 271 postings waiting to be scored. | Reef (more detail). |
| Other tools | Menu drawer. | Tools page with a one-line description per tool. | Tie. |

Not exercised, because they write real data or spend model usage: Save in the wizard,
"Make the next 3 resumes", Draft cover letter, I submitted it, Skip, board moves, and Open & fill
(which opens the real employer form). They call the existing /api/profile, /api/run,
/api/status (set-status.mjs) and the Chrome extension, which Career Reef already uses.

Found in passing: Career Reef's Generate CV button sends the tracker row number to the CV
worker, which expects the report number. The two differ only for two skipped jobs
(Cloudburst Consulting Group, Housing & Community Development Analyst; TelyRx, Business Analyst,
Commercial & Ops), which the Reef does not show, so nothing is affected today. X sends the report number.

Change made during the comparison: X first counted a job as ready only when its cover letter
existed too, which showed 1 ready job against the Reef's 8. X now uses the Reef's rule
(tailored resume, plus the SOQ when the posting asks for one) and shows the missing cover letter as a dot.

Suggested merge: bring X's match checklist and remote filter, the two-lane apply queue,
the resume page with ATS check, the tracker board and the setup wizard into main. Keep the Reef
home as the overview, and keep its "Verify first" tab and status panel.
