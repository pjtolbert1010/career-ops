# Custom Instructions -- career-ops

<!-- ============================================================
     THIS FILE IS YOURS. It will NEVER be auto-updated.

     Put your own house rules, custom workflows, and automations
     here -- anything you want the agent to ALWAYS do (or never do).

     This is for PROCEDURAL rules ("HOW I want things done").
     For WHO you are (archetypes, narrative, comp, negotiation),
     use modes/_profile.md instead. Keeping the two separate keeps
     each one readable.

     The agent reads this file alongside the system instructions;
     your rules here take precedence over the defaults, as long as
     they don't break the Data Contract (your files are never
     touched, and we never auto-submit an application for you).

     Because this is a user-layer file, anything you write here
     survives `node update-system.mjs`. Put customizations HERE,
     not in CLAUDE.md / modes/_shared.md / other system files --
     those get overwritten on update.
     ============================================================ -->

## House Rules

- Always close cover letters and application emails with:
  ```
  Kindly,
  Patrick Tolbert
  ```
  Never "Sincerely," and never the middle initial "J." in the signature.
- Professional references for any application that requires them — see `references.md` (repo root). Always use those three exactly as given, never invented or substituted.
- **Never use an em dash (—) anywhere in generated writing** — CVs, cover letters, application-form short-answer responses, emails, outreach messages. It reads as an obvious AI-writing tell. Use a period, comma, or parenthesis instead. This applies to every mode that produces candidate-facing text, not just `pdf`/`cover`.

## Standing Application-Question Answers

These recur near-verbatim across most CA county/city government job applications (NEOGOV/GovernmentJobs platform). Use these as the default answer whenever the same question appears on a new application, without asking again:

- Were you ever a member of CalPERS / a State or Public Employees Retirement System? **Yes** — current employer: CDPH (California Department of Public Health). *(Start date not on file — ask me per-application if the form requires exact dates; CDPH employment itself should also be added to `cv.md`/`config/profile.yml` as current work history, not just used here.)*
- Were you ever discharged, released during probation, or resigned under pressure/unfavorable circumstances from any job? **No**
- Are you now, or have you ever been, employed by [the specific agency/county/city on this application]? **No** (this is agency-specific, so re-verify it's actually "no" for that employer each time rather than assuming)
- Are you related by blood or marriage to anyone employed by [that agency]? **No**
- Will you accept Permanent Part-Time work (<40 hrs/week)? **Yes**
- Will you accept Temporary/Extra Help work? **No**
- Will you accept Evening work (to 10pm)? **Yes**
- Will you accept Overnight work (after 10pm)? **Yes**
- Will you accept Saturday/Sunday work? **No**
- EEO race/ethnicity question: **always leave blank** (voluntary, never answer)
- EEO sex question: **Male**

## Custom Workflows

<!-- Multi-step routines you run often, given a short name. Examples:
     - "weekly review": scan my saved portals, evaluate the new roles,
       then give me a one-paragraph summary of the top 3.
     - "prep <company>": pull the JD, generate STAR stories from
       article-digest.md, and draft 5 likely interview questions. -->

- **Application documents (Career Reef).** Every application keeps its own tailored documents, found by tracker row number in `output/`:
  - CalCareers (State of California) postings: a Statement of Qualifications via the `soq` mode (`modes/soq.md`, `/career-ops soq {tracker#}`) whenever the posting requires one. Follow the posting's SOQ rules literally (font, size, page limit, numbered prompts, header). If a CalCareers posting asks for a cover letter instead of an SOQ, write a cover letter within the posting's page limit.
  - Every other job: a tailored cover letter via the `cover` mode, saved as `output/cover-{NNN}-{company}-{role}-{date}.pdf` (`generate-cover-letter.mjs --out` with that name).
  - In Chrome, the `career-reef-soq` and `career-reef-cover-letter` skills draft, save and attach these, and the career-ops Apply extension attaches them when its toggles are on.
- **Automatic documents (2026-11-05).** Every Evaluated job scoring **3.5 or higher** must have its documents ready for upload: the tailored CV, plus the SOQ when the posting asks for one and a cover letter otherwise (both when it asks for both). Remote jobs come first. `node docs-due.mjs` lists what is missing, in order; the `career-ops-queue-feeder` scheduled task makes it on every run. In those unattended runs:
  - Check the posting is still open first (closing date, `node check-liveness.mjs <url>`); a closed one goes to Discarded via `set-status.mjs`, no documents.
  - The cover letter and SOQ skip the interactive confirmation steps of `modes/cover.md` (research synthesis, angles, optional questions) and `modes/soq.md`: write them only from cv.md, article-digest.md, config/profile.yml and modes/_profile.md, with no optional section that needs my answers. The fact gate still has to pass, and nothing is invented. An SOQ prompt my sources cannot answer honestly gets the honest answer (as on JC-535245: "no formal supervisory role"), never a made-up one; if that would leave the SOQ hollow, write none and list it in the summary.
  - These are drafts for my review: I read every document before I upload it.

## Output Preferences

<!-- How you like results formatted. Examples:
     - Reports: lead with the score and the one-line verdict.
     - Show the per-step token breakdown after a batch run.
     - Save PDFs date-first: YYYY-MM-DD-company.pdf -->

(none yet -- add yours above)

## Application-Status Detection

- Treat a posting as **Applied** once an email containing that job's title is sent to anyone outside my immediate family (checked against my real outbound mail, never inferred from a draft or a queued request). On detecting one, update the matching tracker row to Applied via `set-status.mjs` and note it was detected from sent mail.

## CV Fact-Gate (non-negotiable)

- `node verify-cv-facts.mjs <output-file>` MUST be run and MUST pass before any tailored CV, cover letter, or SOQ/form-answer file is shown to me as ready, regardless of which mode or which run produced it -- including a run scoped to "evaluation and reporting only" that happens to also emit an HTML/PDF. A report that says "PDF not generated, run pdf mode separately" does not exempt that later run from this gate. On a failure, do not soften or reframe the number -- fix the source text so it matches cv.md/article-digest.md, or ask me. (Background: a $500M figure a model invented during tailoring -- 25x the real $20M in cv.md -- silently propagated across six evaluation reports' reasoning and into two built CVs, one of which was already emailed to a real employer, because this gate was documented as a step but never actually run for those builds. See config/cv-facts.json, which now explicitly forbids that exact phrase as a backstop.)

## Screening Override — Remote + $100K Floor (non-negotiable)

- A posting whose description states it is fully remote OR mostly remote, AND whose base salary (advertised, or the top of a stated range) is at or above **$100,000**, must never be auto-tossed/discarded by a pre-screen filter, title/location mismatch, or any automated triage step. It goes to me for review instead — score it and surface it, even if other signals would normally justify a toss. "Mostly remote" includes a posting that states remote with limited/occasional in-office days; it does not include "hybrid" used as a near-synonym for onsite-heavy schedules — if the remote/hybrid split is unclear, treat it as qualifying and let me decide.

## Off-Limits

- Never submit, send, or click Apply on any application. Always draft the full package (CV, cover letter, SOQ/form answers) and show it to me first. I give the go-ahead per application, not as a standing approval.

## Application form filling

- When an application form is open, fill each field whose label matches an entry in `config/answers.yml` using its `labels[]` values.
- For a field with no matching entry, ask me once for the value, then tell me to add it to `config/answers.yml`.
- Never type a value whose entry has `sensitive: true` into a field. Show me the value and let me paste it myself.
- Never click Submit, Send, or Apply.

## Career Reef and CalCareers (lessons from JC-535245, 2026-11-04)

Full lesson index and test log: `data/lessons-learned.md`. The skills that own each rule are `web/claude-skill/career-reef-soq` and `web/claude-skill/career-reef-cover-letter`.

- Never use the job-site tab for Career Reef pages. Open `localhost:3000` in a new tab and confirm the tab id before every navigate.
- Never fabricate experience. Use only `cv.md`, `article-digest.md`, and my words in chat. If a question asks for experience I lack (for example supervision), answer honestly from related facts, even if I ask you to make something up.
- Read the full posting, to the last line, before deciding what documents it needs. On CalCareers the SOQ can be called "Supplemental Questionnaire" and sit under Special Instructions at the bottom. Do not trust `needs.soq: false` alone.
- CalCareers uploads open in a popup from the Application Package step. Use the visible file input only. If the page ignores the file, stop and give me the `localFile` path to attach myself. Never retry in a loop.
- `fact_warnings` must be empty before any SOQ or cover letter is attached. The saved text must match the draft I approved, word for word.
- Never fill EEO or demographic questions. Never press Save & Review, Submit, or Next past the Application Package step without my go-ahead.
