# MindMate

**AI-Powered Student Wellbeing, Financial Support & Opportunity Platform — built for students in Pakistan.**

> Current state: **Phase 1 vertical slice, working end-to-end.** Plan: [`docs/PLAN.md`](docs/PLAN.md).

MindMate turns *"I'm stressed"* into *"here is the specific funding, service or information that addresses the actual cause."* A financial concern routes to scholarship matching, not to a breathing exercise.

---

## Quick start

```bash
npm install
npm run db:migrate      # SQLite (prisma/dev.db)
npm run db:seed         # Pakistan config + 14 public opportunities + 3 synthetic students
npm run dev             # http://localhost:3000
```

```bash
npm test                # 41 unit tests, no test framework needed (node:test + tsx)
npm run build           # production build
```

Already seeded? Just run `npm run dev`.

---

## What works right now

| Flow | Status |
|---|---|
| Financial Need Score with a full, attributable breakdown | ✅ Working |
| Concern classifier (tags + weighted lexicon, negation & intensifier handling) | ✅ Working |
| Rule-based eligibility engine with per-criterion explanations | ✅ Working |
| Ranked matches with score components, reasons and near-misses | ✅ Working |
| Daily check-in form + trend view + concern → remedy routing | ✅ Working |
| Opportunity detail with requirement-by-requirement evaluation | ✅ Working |
| Support directory + crisis surface | ⚠️ Unverified placeholder contacts |
| Deadline reminders | ❌ Deadlines intentionally blank |
| Auth, admin dashboard, community, applications | ❌ Not built yet |

Switch between the three synthetic demo students using the bar under the header — the ranking changes because **need** changes.

---

## Architecture

```
src/
├─ domain/          PURE TypeScript. No I/O, no framework imports, fully unit tested.
│  ├─ financial/    Financial Need Score
│  ├─ matching/     eligibility filters + scorer + reasons
│  ├─ wellbeing/    concern classifier + crisis detection
│  └─ shared/       math helpers
├─ config/          Pakistan data: income bands, anchors, weights, helplines
├─ server/          the ONLY code that touches Prisma
│  ├─ db/client.ts
│  └─ services/     matching.service.ts (DB rows → domain input → view models)
└─ app/             Next.js App Router pages
prisma/             schema, migrations, seed data (public listings)
tests/unit/         node:test suites
```

The important rule: **`domain/` cannot import `server/`, `next/` or `@prisma/client`.** That is what makes the scoring logic defensible in an evaluation and makes the SQLite → Postgres switch a one-folder change.

### Why rules first, AI second

Scholarship eligibility is decided by a two-stage deterministic engine:

1. **Hard filters** (binary, must pass) — country, degree level, field, age, minimum CGPA, financial-need threshold, closed deadlines.
2. **Soft scoring** (0–100, explainable) — need fit, coverage value, academic fit, field fit, deadline urgency, application effort — adjusted by a data-freshness factor and a profile-completeness factor.

Every match stores its full breakdown, so a student sees the same explanation twice and any recommendation can be audited later. **No language model participates in eligibility.** When an LLM is added it may only rewrite the prose describing a result — it can never invent a scholarship, requirement or deadline.

---

## Financial Need Score

Weighted, versioned, and re-computable. Weights and anchors live in a `ScoringWeightSet` row, so any historical score stays explainable.

| Factor | Weight | Direction |
|---|---:|---|
| Household income band (PKR/month) | 30 | more income ⇒ less need |
| People supported at home | 20 | more dependents ⇒ more need |
| Family earning members | 15 | more earners ⇒ less need |
| Tuition burden (annual) | 20 | higher tuition ⇒ more need |
| Self-funded accommodation | 10 | higher cost ⇒ more need |
| Support already received | 5 | full existing aid ⇒ less need |

Missing inputs **renormalise the remaining weights** instead of guessing, and the result is flagged provisional.

**Language rules (test-enforced):** the system never says "poor", "deserving" or "low-income". It says *"you may qualify for need-based financial assistance."* Students only ever see their own score.

---

## Honest limitations — read before showing this to anyone

1. **Deadlines are intentionally `null`.** I would not invent application dates. A wrong deadline wastes a student's time and destroys trust in every other date shown. Fill `deadline` from each `sourceUrl`.
2. **All 14 listings are `UNVERIFIED`.** They are real, publicly-run programmes that Pakistani students use, but the **eligibility criteria are indicative, not confirmed**. The engine reflects this: unverified rows get a 0.75 freshness factor and an `UNVERIFIED_SOURCE` badge, and the UI always shows the source link.
3. **Crisis contact numbers are unverified placeholders.** An unverified crisis number is worse than none. The UI warns on every one. **A human must confirm these before any user sees the app.**
4. **Gender eligibility is assumed-eligible.** The profile doesn't capture gender yet, so a `GENDER` criterion is reported as "assumed — add your details" and lowers the confidence factor. A female student may see a women-only award she is not eligible for. Fix: add gender to the profile (schema has no column yet).
5. **No authentication.** The demo resolves a student from `?s=0|1|2`. Auth is milestone M0/M1 and is the first thing to build next.
6. **SQLite** is fine for development; move to Postgres before real traffic (single-writer lock, no full-text search).

---

## Tests

41 tests, no framework dependency (vitest 5 has a peer conflict with React 19, so this uses `node:test` + `tsx`):

- boundary values at exact normalisation anchors
- monotonicity (more earners ⇒ never higher need; higher tuition ⇒ never lower)
- weight renormalisation when inputs are missing
- **hard-filter behaviour**, including assumed-eligible-on-missing-data
- near-miss detection vs. genuine dead ends
- freshness ordering (verified > unverified > stale)
- classifier negation, intensifiers, tag precedence, below-threshold refusal
- **crisis-language detection**
- **product invariants**: no stigmatising copy, no clinical vocabulary ever emitted

```bash
npm test
```

---

## Next steps, in order

1. Authentication + real onboarding (register → profile → consent) — milestone M0/M1
2. Populate real deadlines + verify eligibility criteria from `sourceUrl`; switch listings to `VERIFIED`
3. Gender in the profile; resolve assumed-eligible gender criteria
4. Confirm crisis numbers with real Pakistani services
5. Match-run persistence (`MatchRun` / `ScholarshipMatch` tables exist but are not written yet)
6. Application tracker + deadline reminder cron
7. Admin: opportunity CRUD/import, verification queue, aggregate-only analytics with k-anonymity ≥ 10
8. Community + moderation; evaluation harness in `eval/` → `docs/EVAL.md`
9. Optional LLM enrichment (explanations only, off by default)

---

## Tech

Next.js 16.3 (App Router) · React 19.2 · TypeScript strict · Tailwind CSS 4 · Prisma 7.10 (stable, SQLite → Postgres) · Zod 4 · `node:test`

Prisma note: npm's `latest` tag currently points at an 8.0 release candidate. This project pins the **stable 7.10.0** for the data layer.
