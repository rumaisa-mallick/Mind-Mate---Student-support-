# MindMate

**AI-Powered Student Wellbeing, Financial Support & Opportunity Platform — built for students in Pakistan.**

> Current state: **Phase 2 complete.** Monochrome design, personalisation questionnaire, verified HEC programmes, financial planner. Plan: [`docs/PLAN.md`](docs/PLAN.md).

MindMate turns *"I'm stressed"* into *"here is the specific funding, service or information that addresses the actual cause."* A financial concern routes to scholarship matching, not to a breathing exercise.

---

## Quick start

```bash
npm install
npm run db:migrate      # SQLite (prisma/dev.db)
npm run db:seed         # Pakistan config + 19 opportunities + 3 synthetic students
npm run dev             # http://localhost:3000
```

```bash
npm test                # 144 unit tests, no test framework needed (node:test + tsx)
npm run typecheck       # tsc --noEmit
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
| 5-step personalisation questionnaire (`/onboarding`) | ✅ Working |
| Financial planner: income → expenses → fee terms → buffer → levers (`/finances`) | ✅ Working |
| Timezone-correct deadlines with the real closing time | ✅ Working |
| 5 HEC programmes VERIFIED from hec.gov.pk, criteria and deadlines | ✅ Working |
| Monochrome throughout — no hue, state carried by shape and glyph | ✅ Working |
| Support directory + crisis surface | ⚠️ Unverified placeholder contacts |
| 14 further public listings | ⚠️ Real programmes, indicative criteria only |
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
│  ├─ finance/      budget planner, levers, fee terms
│  ├─ personalisation/  profile building, priority labels
│  └─ shared/       math helpers + deadline/date maths
├─ components/      shared UI primitives — the monochrome rule lives here
├─ config/          Pakistan data: income bands, anchors, weights, helplines
├─ server/          the ONLY code that touches Prisma
│  ├─ db/client.ts
│  └─ services/     matching.service.ts, planning.service.ts, demo.ts
└─ app/             Next.js App Router pages (9 routes)
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

## Deadline integrity

This is the requirement the product is most easily caught failing on, so it is enforced in one module (`src/domain/shared/dates.ts`) rather than trusted to each page.

**Deadlines are wall-clock moments in Pakistan, not UTC.** HEC publishes "20 Oct 2026, 4:00 PM". That is PKT. Storing it as end-of-day-UTC handed every student eight hours that do not exist, and rendering it with `toISOString()` showed a Karachi student the wrong calendar day.

| Rule | Where it lives |
|---|---|
| A published local time becomes an instant in exactly one way | `pkrInstant()` |
| A stored value becomes an instant in exactly one way | `deadlineInstant()` |
| A bare `YYYY-MM-DD` means "no time published" → 23:59 PKT, never 00:00 | `deadlineInstant()` |
| When no time was published, the UI says so rather than showing our fallback | `formatDeadline()` |
| Day counts compare calendar days in Asia/Karachi, so no DST term enters | `daysUntil()` |
| **"Closes today" is not a disqualifier** — only a past instant closes it | engine `matchOpportunity` |

That last rule matters most. An earlier iteration hard-filtered anything closing today, which tells a student *"not eligible"* when they can still apply in four hours. A false negative is the one class of error this engine must never emit, so urgency is carried by the `DEADLINE_NEAR` reason instead. Both the bug and the fix are regression-tested.

---

## Verified HEC programmes

Five programmes are `VERIFIED` — criteria **and** deadline read from hec.gov.pk on 2026-10-05, each with `sourceUrl` and `lastVerifiedAt`:

| Programme | Deadline (PKT) | Notable criteria |
|---|---|---|
| HEC–Commonwealth Masters & PhD 2027-28 | **20 Oct 2026, 16:00** | 26 MSc + 30 PhD nominations · first division · HAT ≥ 60/100 · dual nationals excluded |
| HEC Overseas Scholarships Phase-III Batch-IV | 28 Aug 2026 (closed) | MS/MPhil + PhD only · top-200 QS/THE · HAT ≥ 60 |
| HEC–Heydar Aliyev Grant (Azerbaijan) | 20 Mar 2026 (closed) | Master's students only |
| HEC–Stipendium Hungaricum | 15 Jan 2026 (closed) | 18+ at cut-off · service obligation may apply |
| HEC/GCUF Need-Based Scholarship | none published | monthly family income ≤ Rs 45,000 · not for self-finance students |

The HAT and the Rs 45,000 income ceiling are **hard criteria**, not scoring inputs — they are what real programmes gate on, and getting them wrong would falsely disqualify or falsely qualify a student.

OGDCL's need-based scholarship is **deliberately not seeded**: the published detail was not specific enough to encode as a rule, and a vague rule is worse than an honest absence.

The remaining 14 listings are real, publicly-run programmes Pakistani students use, but their **criteria are indicative only**. They stay `UNVERIFIED`, get a 0.75 freshness factor, carry a dashed "⚠" badge, and always link the source.

---

## Honest limitations — read before showing this to anyone

1. **Crisis contact numbers are unverified placeholders.** An unverified crisis number is worse than none. The UI warns on every one. **A human must confirm these before any user sees the app.** This is the largest remaining blocker.
2. **14 listings have indicative criteria only.** They are demoted and badged, but a student could still apply to one and find the real requirement differs.
3. **Deadline data is a snapshot.** The five verified programmes were read on 2026-10-05. Cycles change; `lastVerifiedAt` says when, and the UI tells students to confirm before investing time.
4. **The planner is arithmetic, not advice.** It quantifies options in PKR from the student's own numbers. It will never tell a student to cut social spending — the spend is shown so the budget adds up, and the decision is handed back. Enforced by test, not by convention: the social row carries `monthlyImpact: 0`, is labelled "your call", and no lever may use instruction language. Three bugs broke this rule and are now regression-tested: an explicit *"Trim Social & outings by a third"* lever, that lever double-counting inside the 20% non-essential trim, and a `|| 5_000` fallback that invented a bursary figure for a student with no shortfall.
5. **Personalisation changes ordering, tone and depth — never eligibility.** A criterion outcome is identical with and without a profile, enforced structurally.
6. **Registration demands no financial documents.** `/onboarding` asks for numbers, never for proof.
7. **No authentication.** The demo resolves a student from `?s=0|1|2`. Auth is milestone M0/M1.
8. **SQLite** is fine for development; move to Postgres before real traffic (single-writer lock, no full-text search).

---

## Monochrome

No hue anywhere. State is never carried by colour alone — colour-blind students and monochrome printing both make colour-only signalling unsafe in an education context.

| Meaning | Fill | Border | Glyph |
|---|---|---|---|
| affirmative | solid black | 1px black | ✓ |
| caution | white | **dashed** | ⚠ |
| negative | white | **2px** black | ✕ |
| provisional | **hatched** | — | ⚠ |

The `.mm-*` classes live in `@layer components` so a Tailwind utility on the same element wins. Outside the layer, `.mm-choice { align-items: center }` silently beat `items-start` on every long option label. Mood options render as words, not emoji — emoji reads as a game, and the label has to be honest for a distressed student.

---

## Tests

144 tests, no framework dependency (vitest 5 has a peer conflict with React 19, so this uses `node:test` + `tsx`):

- boundary values at exact normalisation anchors
- monotonicity (more earners ⇒ never higher need; higher tuition ⇒ never lower)
- weight renormalisation when inputs are missing
- **hard-filter behaviour**, including assumed-eligible-on-missing-data
- near-miss detection vs. genuine dead ends
- freshness ordering (verified > unverified > stale)
- classifier negation, intensifiers, tag precedence, below-threshold refusal
- **crisis-language detection**
- **product invariants**: no stigmatising copy, no clinical vocabulary ever emitted
- **deadline integrity**: UTC/Pakistan day divergence, DST-free day counts, bare-date resolution, "closes today" vs "already closed", a whole-year property check that consecutive days never drift
- planner: surplus reported as surplus, funding target zero when there is no shortfall, terms forced ≥ 1, levers sorted by value, no lever claiming the same rupees twice, no social-spending instructions

Writing these tests was not a formality. Each of the fourteen bugs listed in [`docs/PLAN.md` §0.1](docs/PLAN.md) was live before its test existed — including two false negatives where the engine would have told an eligible student they were not eligible, and one where the planner told a student what to give up.

```bash
npm test
```

---

## Next steps, in order

1. **Confirm crisis numbers with real Pakistani services** — the blocker before any user sees this
2. Authentication + real onboarding (register → profile → consent) — milestone M0/M1
3. Verify eligibility criteria for the remaining 14 listings from their `sourceUrl`; switch them to `VERIFIED`
4. Match-run persistence (`MatchRun` / `ScholarshipMatch` tables exist but are not written yet)
5. Application tracker + deadline reminder cron (the date maths is ready for a scheduler)
6. Admin: opportunity CRUD/import, verification queue, aggregate-only analytics with k-anonymity ≥ 10
7. Community + moderation; evaluation harness in `eval/` → `docs/EVAL.md`
8. Optional LLM enrichment (explanations only, off by default)

**Still unanswered from earlier sessions:** is a real university partner possible? One partner's real financial-aid office, tuition figures and internal deadlines would move this from a demo to something actionable.

---

## Tech

Next.js 16.3 (App Router) · React 19.2 · TypeScript strict · Tailwind CSS 4 · Prisma 7.10 (stable, SQLite → Postgres) · Zod 4 · `node:test`

Prisma note: npm's `latest` tag currently points at an 8.0 release candidate. This project pins the **stable 7.10.0** for the data layer.
