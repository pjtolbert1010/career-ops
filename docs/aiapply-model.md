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
4. Run on port 3100 with `CAREER_OPS_ROOT=C:\career-ops` so it reads the real
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

## 5. Side by side: Career Reef (main, :3000) vs Career ops X Ai apply (this branch, /x on :3101)

Checked in the browser on 2026-11-05 against the real data (CAREER_OPS_ROOT=C:\career-ops).
Nothing was saved, generated or submitted during the checks.

| Flow | Career Reef `/reef` | X `/x` | Better |
|------|---------------------|--------|--------|
| Home | Long editorial page: video hero, stats, openings, remote boards, review, pipeline, status. Beautiful, but the next action is a scroll away. | One headline ("1 job is ready to apply"), one primary button, setup checklist, 4 stats, top 3 matches, recent applications. | X for speed; Reef for atmosphere. |
| Job matching | Cards with fit /10, zone tabs (Apply-first, closer look, verify). | Cards with match /100, fit label, "why it fits", ✓/~/✗ qualification checklist from the report's CV Match table; search, Remote only, Ready only, min score. | X (checklist and filters). Reef's verify-first zones are clearer about liveness. |
| Job detail | Facts, why it fits, verification, Apply, Generate CV, documents. | Same actions plus full qualification checklist, "I submitted it" (marks Applied) and "Skip" (Discarded) with Undo. | X (fewer trips to the tracker). |
| Apply queue | "Ready for review" list. | Two lanes: Ready to apply (Open & fill per job) and Needs documents ("Make the next 3 resumes" in one press). | X. |
| Resume | `/cv` editor, separate. | Base resume, every tailored version, ATS keyword coverage per job (keyword-match.mjs). | X. |
| Cover letter | Instructions to use Chrome skill or CLI. | Existing cover form inline in the job panel. | X, slightly. |
| Tracker | Applied list on Reef; `/pipeline` table. | Board by stage with one-press moves (Responded, Interview, Rejected, Offer, Hired). | X for glanceability; `/pipeline` still better for bulk work. |
| Onboarding | Onboarding banner, scattered pages. | 3-step wizard: resume import, roles/salary/where (writes only changed fields), done. | X. |
| Tools | Menu drawer. | Tools hub with one-line descriptions. | Tie. |

Not exercised (they write real data or spend model usage): Save in the wizard, "Make the next 3
resumes", "I submitted it", "Skip", tracker moves, Open & fill. They call the existing
`/api/profile`, `/api/run` (pdf), `/api/status` (set-status.mjs) and the extension.

Found in passing: Reef's Generate CV passes the tracker row number to the pdf worker, which
expects a report number. They differ on 2 of 119 rows; X passes the report number.

Suggested merge: take X's match checklist, remote filter, queue lanes, ATS check, tracker board
and wizard into main; keep Reef's editorial home as an optional overview.
