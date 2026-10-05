# MindMate — Product & Engineering Plan

> **AI-Powered Student Wellbeing, Financial Support & Opportunity Recommendation Platform**

Status: **Phase 1 vertical slice built and working** (see §0.1).
Plan version: 0.2 · Date: 2026-10-05

---

## 0.1 Build status

Scope of the first build session: **Pakistan launch, public data only.** What exists now:

| Plan item | Status |
|---|---|
| §3.3 Stack (Next 16.3.8 / React 19.2 / Prisma 7.10 stable / Tailwind 4 / Zod 4) | ✅ as specified |
| §4.1 Financial Need Score + versioned `ScoringWeightSet` | ✅ 41 tests green |
| §4.2 Concern classifier (tags + weighted lexicon, negation, intensifiers) | ✅ |
| §4.3 Eligibility engine: hard filters → soft scoring → reasons → near-misses | ✅ |
| §5 Data model (17 models) + migration | ✅ |
| §7.1 Pages: dashboard, financial, opportunities, detail, check-in, support | ✅ 6 pages |
| §7.2 Check-in write path (server action) + `getMatchView` service | ✅ verified |
| §9 Tests (unit + product invariants) | ✅ 41 tests, no framework dependency |
| Auth (Better Auth) | ❌ not started — demo resolves `?s=0\|1\|2` |
| Opportunity deadlines | ❌ deliberately `null` (see below) |
| Verification workflow / admin CRUD | ❌ listings are all `UNVERIFIED` |
| `MatchRun` / `ScholarshipMatch` persistence | ❌ tables exist, not written |
| Applications, community, moderation, admin analytics, `eval/` | ❌ not started |

Deviations from the plan, both recorded:

1. **Vitest could not be installed** — `vitest@5.0.3` has a peer conflict with React 19 / Next 16. Tests run on `node:test` + `tsx` instead (`npm test`). Revisit if the conflict clears.
2. **Test imports use explicit `.ts` extensions**, which required `allowImportingTsExtensions` in `tsconfig.json`. Harmless alongside `noEmit`.

Data honesty decisions made during the build, not in the original plan:

- **No application deadlines were invented.** All seeded deadlines are `null` and the UI says so explicitly. §11/R1 governs.
- **Eligibility criteria are indicative, not verified.** Every listing is seeded `UNVERIFIED`, which demotes it via `freshnessFactor` (0.75) and forces an `UNVERIFIED_SOURCE` badge in the UI.
- **Crisis numbers are unverified placeholders**, labelled as such on `/support`. A human must confirm them before launch (§6.3).
- **Gender is not in the profile yet**, so a `GENDER` criterion is assumed-eligible and reported as "assumed — add your details". Known false-positive path; fix by adding gender to `StudentProfile`.

---

## 0. How to read this document

| Section | Purpose |
|---|---|
| 1–2 | What the product is, who it serves, what it deliberately does not do |
| 3 | Architecture and the stack (with versions verified today) |
| 4 | Domain engines: financial need score, concern classifier, eligibility engine |
| 5 | Data model (Prisma) |
| 6 | Privacy, safety and ethics — **read this before writing any wellbeing code** |
| 7 | API surface and routes |
| 8 | Roles and permissions |
| 9 | Testing and evaluation |
| 10 | Ops, security, cost |
| 11–13 | Milestones, risks, repo layout |
| 14–15 | Phase 1 task list, decisions log, open questions |

**This plan is unvalidated by implementation.** Library versions were checked against npm on the plan date; pricing, adapter requirements and framework conventions must be re-confirmed at install time. Claims about third-party libraries are stated as "confirm at install" where I have not executed them.

---

## 1. Product definition

### 1.1 One line

MindMate is a wellbeing platform that converts *"I'm stressed"* into **"here is the specific resource, funding, or person that addresses the actual cause."**

### 1.2 The wedge

Most products pick one lane:

| Product type | What it does | What it misses |
|---|---|---|
| Mental-health apps | Calms you down | Money is the actual cause; breathing exercises feel dismissive |
| Scholarship portals | Lists funding | Doesn't know who needs funding, or why they're anxious |
| Student portals | Admin forms | Dead end, no guidance |

MindMate's differentiator is the **concern → cause → remedy loop**, and specifically the bridge between **financial stress** and **funding access**:

```
Check-in / free text
      ↓
Concern classifier (Financial · Academic · Career · Family · Social · Sleep)
      ↓
If Financial → Financial Need Score (transparent, versioned weights)
      ↓
Eligibility rule engine over a verified opportunity database
      ↓
Ranked matches with per-criterion reasons + required-document checklist
      ↓
Deadline reminders → application tracker → applied
      ↓
Aggregate-only signal to staff about *which* services need capacity
```

The thing that must be excellent: **the scholarship/opportunity matching**. Everything else is a funnel into it, or a support surface on the way out.

### 1.3 Users

| User | Job to be done | Success = |
|---|---|---|
| **Student** (primary) | "Find out what support/funding I'm entitled to, and stop feeling lost about it." | Opens a matched opportunity and applies |
| **Advisor / Counselor / Financial-aid officer** | "See demand, see who needs an urgent hand-off, without reading private journals." | Resolves a queue; capacity matches demand |
| **Admin / data steward** | "Keep the opportunity database trustworthy; prove impact; stay lawful." | Stale listings < 5%; zero data incidents |

### 1.4 Non-goals (v1) — the anti-feature list

These are the cuts that protect the schedule:

- **No mental-health diagnosis, therapy, or clinical advice.** Ever. See §6.
- **No AI-generated scholarship facts.** The LLM writes prose *about* rule output. It never invents a scholarship, a deadline, or a requirement. (See risk R5.)
- **No live chat / DMs between students.** Anonymised topic threads only. Chat is a moderation, safety, and abuse minefield.
- **No payments, no document uploads with PII in v1.** (Scholarship applications happen on the provider's site in v1; we track state.)
- **No native mobile app.** Responsive web first.
- **No microservices in v1.** See §3.2.
- **No scraping scholarship providers at scale in v1.** Seeded/curated + admin-managed import.

### 1.5 Success metrics (what to instrument from day one)

| Metric | v1 target | Why it matters |
|---|---|---|
| Hard-filter precision | **1.00** (never surface an ineligible scholarship as eligible) | Trust + reputational/legal exposure |
| Match coverage | ≥ 85% of the student's genuinely eligible opportunities surfaced in top 20 | Don't hide funding |
| NDCG@10 (on labelled set) | ≥ 0.75 | Ranking quality |
| Check-in → remedy click-through | ≥ 30% | Loop actually works |
| Opportunity → application started | ≥ 25% of matched | Real-world value |
| Opportunity DB staleness (>90 days unverified) | < 5% | Data trustworthiness |
| Mean stress level trend | Declining over 8 weeks | Wellbeing outcome (aggregate only) |
| Crisis escalation → helpline view | 100% | Safety invariant |

---

## 2. Scope

### In scope for v1 (MVP → v1.1)

1. Auth, email verification, password reset, student profile onboarding
2. Academic + financial profile (income **bands**, not documents)
3. Daily wellbeing check-in (mood, stress 1–10, structured factor tags, optional note)
4. Concern classification (rules; optional LLM enrichment)
5. Financial Need Score with visible, versioned, explainable weights
6. Opportunity + Scholarship database with verification status and provenance
7. Rule-based eligibility + scoring + reasons + "near-miss" explanations
8. Student dashboard: matches, deadlines, trend, next actions
9. Application tracker with document checklist
10. Resource library + support directory (advisors, financial aid, crisis lines)
11. Anonymous community (topic threads + moderation + reporting)
12. Admin: database CRUD/import, verification workflow, scoring-weight versions, **aggregate-only** analytics
13. Consent records, data export, account deletion, audit log
14. Evaluation harness with labelled fixtures

### Explicitly deferred

- Mobile app · native push · email campaign tooling · multi-language UI (data is language-ready, UI is English-first)
- ML ranking model (start with a transparent weighted score; learn from logged impressions first)
- Partnerships / provider API integrations · payments · document e-signature
- Predictive "at-risk dropout" modelling (high ethical risk, low data quality at seed stage)

---

## 3. Architecture

### 3.1 Chosen shape

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js (App Router) — single deployable                    │
│                                                             │
│  Route Handlers / Server Actions  ──► validation (zod)      │
│  React Server Components + client islands                    │
│  Auth (Better Auth or Auth.js) ──► session, RBAC             │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Domain layer (pure TypeScript — no I/O, fully unit    │  │
│  │  testable): financial-need, concern-classifier,        │  │
│  │  eligibility engine, match scorer, ranker, explainer   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Data-access layer (the ONLY code that touches Prisma) │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LLM adapter (optional; hard timeout, token cap,      │  │
│  │  no-scholarship-facts rule enforced by prompt + code) │  │
│  └───────────────────────────────────────────────────────┘  │
│                      Prisma ──► SQLite (now) / Postgres (later)│
└─────────────────────────────────────────────────────────────┘
        Cron/worker: deadline reminders · staleness sweep · aggregates
```

**The single most important structural decision:** the domain layer is **pure functions over plain data**, and **all** database access is confined to the data-access layer. Two payoffs: the scoring logic (the part that must be defensible in an evaluation) is unit-testable with zero infrastructure, and the SQLite → Postgres switch touches exactly one folder.

### 3.2 Why not Express + Postgres + Python (deviation from the original sketch)

Honest reasoning, not preference:

| Original | Why I'm changing it |
|---|---|
| Separate Express API | Duplicates validation/auth/error-handling that Next already provides, and forces a CORS + deploy + version surface. For a real product with a small team this is cost with no user-visible benefit. |
| Separate Python AI service | Justified *later*, when there is a real model to serve (classification embeddings, ranking model). Until then it is a process boundary around a lexicon. Keep the seam: `domain/` is pure TS and provider-agnostic, so it splits cleanly. |
| Postgres required up front | Correct for production, but blocking day 1 on infra you don't have yet produces nothing. Prisma + SQLite now, Postgres before real users. |

**Trigger for revisiting** (write these down now so it's not a debate later): > 50 concurrent active students, OR a real model needing GPU/CPU serving, OR a team split across ≥ 2 backend engineers.

### 3.3 Stack (versions checked on npm, 2026-10-05)

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | **16.3.8** | Turbopack default; `params`/`searchParams` are async |
| UI | React | **19.3.0** | |
| Language | TypeScript | 5.x | `strict: true`, no `any` in `domain/` |
| Styling | Tailwind CSS | **4.3.3** | CSS-first config (no `tailwind.config.ts` by default) |
| Validation | Zod | **4.6.5** | v4 API |
| ORM | Prisma | **7.10.0 stable** | npm `latest` tag points at `8.0.0-rc.*` — **pin the stable tag**, don't take RCs for a product |
| DB (dev) | SQLite | — | See caveats below |
| DB (prod) | Postgres | — | Neon/Supabase free tier is sufficient to start |
| Auth | Better Auth **or** Auth.js v5 | BA `1.7.7`; `next-auth` `4.24.15` stable / `5.0.0-beta.32` | Prefer **Better Auth** (Prisma adapter, TOTP 2FA, passkeys, admin plugin). `next-auth@4` is the oldest stable option — acceptable fallback. Do **not** adopt `next-auth@5` beta without accepting that risk. |
| Charts | Recharts | **3.10.1** | |
| Jobs | Vercel cron / node-cron | — | Start with an internal admin action; split to a queue only when needed |
| LLM (optional) | Provider-agnostic adapter | — | Default OFF. App must be fully functional without it |

**SQLite caveats — design around these now, or the Postgres migration will hurt:**

| Limitation | Impact | Design response |
|---|---|---|
| No Prisma `enum` on SQLite | Can't type `role`, `moodCode` | Model as `String` + a shared `const` union + zod validation at boundaries |
| No array columns | Can't store `["CS","SE"]` | Use relation tables (`Criterion`, `ScholarshipField`) or JSON strings for free-form blobs |
| No native full-text search | No `contains`-free search | Accept `LIKE`-based search in dev; add Postgres `tsvector` in search phase |
| Single-writer lock | Write contention under load | Fine for dev/seed. Non-negotiable switch to Postgres before real traffic |
| No JSON column type | — | Prisma maps `Json` to text on SQLite — fine, but validate on read |

**Postgres migration plan:** change `datasource.provider`; run a generated migration; add `tsvector` search + GIN indexes; replace `LIKE` queries; re-check every `Json` filter. The data-access layer keeps this to one PR.

---

## 4. Domain engines

These are the product. Each gets a pure module, a version, and an evaluation fixture set.

### 4.1 Financial Need Score (FNS)

**Design constraints:** never label a student; never imply a diagnosis; explain every point; re-score when weights change without destroying history.

**Inputs** (all optional → score is *provisional* if any are missing):

| Factor | Field | Default weight |
|---|---|---|
| Household income | `incomeBandCode` (banded, country-configured) | 30 |
| Dependents supported | `dependents` | 20 |
| Earning members | `earners` | 15 |
| Tuition burden | `tuitionAmount` / income | 20 |
| Accommodation cost | `accommodationStatus` + cost | 10 |
| Existing financial aid | `existingAidCoverage` | 5 |

**Normalisation** — piecewise-linear interpolation between configured anchors, clamped to `[0,1]`, **monotonically decreasing for income, increasing for burden**:

```
incomeNeed( bandMidpoint ) = clamp01( (highAnchor − midpoint) / (highAnchor − lowAnchor) )
dependentNeed( d )         = clamp01( (d − minDependents) / (maxDependents − minDependents) )
earnerNeed( e )            = clamp01( (minEarners − e) / (minEarners − maxEarners) )
tuitionBurden( t, income ) = clamp01( (t − t0) / (t1 − t0) )        // t0,t1 country-configured
accommodationNeed( a )      = 1.0 (self-funded, high) … 0.0 (free, at home)
existingAidNeed( aid )      = 1.0 (none) | 0.5 (partial) | 0.0 (full coverage)

FNS = round( 100 × Σ(wᵢ·nᵢ) / Σ(wᵢ over *available* inputs) )
```

Anchors, weights and bands live in a **versioned `ScoringWeightSet` row** (`version`, `effectiveFrom`, weights JSON, band JSON, `createdBy`). Every stored score records the `weightSetVersion` used, so you can answer "why did this student see X?" months later, and can re-score everyone when you improve the model.

**Bands:** `0–34 low · 35–59 moderate · 60–79 high · 80+ critical`

**Copy rules (hard product requirement):**

| ❌ Never | ✅ Say |
|---|---|
| "Financial need: critical · you are poor" | "Based on your household profile you may qualify for need-based assistance." |
| "You are a low-income student" | "Your profile matches need-based criteria for 5 opportunities." |
| Any ranking of students by poverty | Students only ever see *their own* score. |

The score is **never** shown to peers, never included in community features, and **excluded from admin views** (admins see only aggregate band distributions, k-anonymity threshold ≥ 10, see §6.4).

### 4.2 Concern classifier

Input: optional free-text note + structured factor tags from the check-in form.

**Rules engine (always runs, this is the source of truth):**

1. Structured tags are **labels** — a student who ticks "Money" has a financial concern at high confidence. No NLP needed.
2. Free text → weighted lexicon across `academic · financial · career · family · relationships · loneliness · sleep · health · other`, with:
   - phrase-level entries (multi-word) weighted above single tokens ("can't afford", "tuition fees", "not able to pay" → financial)
   - negation window handling (`"not stressed about money"` must not fire)
   - intensifier scaling (`"extremely", "can't sleep", "always"`)
   - cross-category tie-break by specificity, then by earliest mention
3. Output: `{ category: 0..1 }` per category, `dominantConcern`, `confidence`, `evidence: string[]` (matched phrases — needed for explainability and debugging).
4. Below `confidenceThreshold` → `other` + show a neutral resource list. **Never guess.**

**Optional LLM pass** (only when `LLM_ENABLED=true` and a key exists): refines scores, proposes sub-labels, rewrites the summary in second person. Guardrails: hard 8s timeout, ≤600 output tokens, temperature 0, input truncated to 1,500 chars, output schema-validated by zod, `engineMode: RULES|HYBRID` recorded per analysis, and a **hard rule that no LLM output may contain a scholarship/opportunity name that is not already in the retrieved DB rows**. On any failure → silently fall back to `RULES`. The product never blocks on the LLM.

**Classifier labels are about *circumstances*, not *conditions*.** Output vocabulary is fixed to the 9 categories above. The system never emits "depression", "anxiety disorder", "ADHD", or any clinical term.

### 4.3 Eligibility engine (the core differentiator)

Scholarship requirements are **data, not code**. A scholarship has a set of `Criterion` rows the admin edits and the engine evaluates. No scholarship-specific `if` ever gets written.

**Stage A — hard filters (binary, must pass):**

| Criterion code | Operator examples |
|---|---|
| `COUNTRY` / `NATIONALITY` | `IN`, `NOT_IN` |
| `DEGREE_LEVEL` | `IN` (undergrad/masters/…) |
| `FIELD` | `IN`, `CONTAINS_ANY` |
| `MIN_CGPA` | `GTE` (scale-normalised) |
| `AGE` | `BETWEEN`, `LTE` |
| `GENDER` | only if the provider defines an eligibility criterion |
| `INCOME_NEED` | `LTE` band index (need-based scholarships) |
| `DEADLINE` | `GTE` today |
| `VERIFICATION` | `EQ VERIFIED` |
| `ENROLLMENT_STATUS` | full-time / part-time |
| `PREVIOUS_SCHOLARSHIP` | yes/no |

Result: `eligible: true|false` + `disqualifiedReasons: [{ code, humanText }]`.

**Hard-fail UX:** never a dead end. Show the reason *and* the near-miss cohort:

> Not eligible: age limit 25, you are 26.
> 3 opportunities accept applicants up to 30 · 8 need-based scholarships have no age limit

**Stage B — soft scoring (0–100, explainable):**

| Component | Default weight | Rationale |
|---|---|---|
| Financial-need fit | 30 | Highest for need-based scholarships, ~0 for pure merit |
| Coverage value | 20 | Normalised `(tuition + living + travel)` against *this student's* costs |
| Academic fit | 20 | CGPA margin above minimum (capped — beyond the margin is not extra value) |
| Field/level fit | 15 | |
| Deadline urgency | 10 | Softer as a deadline approaches; never rewards procrastination |
| Application effort | 5 | Document count vs the student's `documentsOnHand` |

```
matchScore = round( Σ(wᵢ·sᵢ) / Σ(wᵢ) × confidenceFactor × freshnessFactor )
confidenceFactor  = penalty for missing student inputs (provisional profile → 0.85…)
freshnessFactor    = 1.00 verified<30d · 0.95 <90d · 0.85 <180d · 0.70 stale+flag
```

Every stored match keeps its **full breakdown, reasons, and disqualifiers**, so the UI never recomputes what the student saw, and so you can audit a bad recommendation.

**Reason codes** (fixed enum → template text, so explanations are consistent and translation-ready):
`CGPA_ABOVE_MIN · NEED_CRITERION_MET · FIELD_ELIGIBLE · AGE_ELIGIBLE · COVERAGE_FULL_FEE · STIPEND_INCLUDED · DEADLINE_NEAR · DOCUMENTS_READY · MERIT_BASED · NEED_BASED`

**Explanation = templates first, LLM polish second.** Templates guarantee the same student sees the same explanation twice, and cost nothing.

### 4.4 Recommendation aggregator

Scores come from multiple engines (scholarships, resources, support services, deadlines) → normalise to `[0,1]`, apply diversity caps (max 3 resources per category; no 5 near-identical scholarships from one provider), boost `deadline < 14d`, and return an ordered, reasoned list. Log impressions + clicks — **this is the training data for the Phase 4 ranking model, so start logging in Phase 1 even though you won't use it yet.**

### 4.5 Trend engine

`stressLevel` series per student → 7-day and 28-day moving average, % change, and a per-category breakdown from `ConcernAnalysis`. Only ever rendered to the owning student and as k-anonymised aggregates.

---

## 5. Data model

SQLite-safe: no enums, no array columns. `Json` is available but validate on read.

```prisma
// ── Identity ───────────────────────────────────────────────────────
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  name          String
  image         String?
  role          String   @default("STUDENT")   // STUDENT | STAFF | ADMIN  (const union + zod)
  status        String   @default("ACTIVE")    // ACTIVE | SUSPENDED | DELETED
  locale        String   @default("en")
  countryCode   String?
  createdAt     DateTime @default(now())
  lastLoginAt   DateTime?
  // relations: StudentProfile, AcademicProfile, FinancialProfile, Checkin, ...
}

// ── Profiles ───────────────────────────────────────────────────────
model StudentProfile {
  id            String  @id @default(cuid())
  userId        String  @unique
  universityId  String?
  degree        String?
  currentSemester Int?
  enrollmentStatus String?  // FULL_TIME | PART_TIME
  fieldOfStudy  String?
  graduationYear Int?
  ageAtSignup   Int?                       // denormalised for matching
  dateOfBirth   String?                    // RESTRICTED: encrypted, engine-only, never in analytics
  profileComplete Boolean @default(false)
  documentsOnHand String?                  // JSON: docCode[] the student already has
}

model AcademicProfile {
  id        String @id @default(cuid())
  userId    String @unique
  cgpa      Float?
  cgpaScale Float  @default(4.0)           // normalise before comparing to criteria
  qualification String?
  achievements String?                     // text, optional, not exported by default
  updatedAt DateTime @updatedAt
}

model FinancialProfile {
  id            String  @id @default(cuid())
  userId        String  @unique
  currency      String?
  incomePeriod  String?                    // MONTHLY | ANNUAL
  incomeBandCode String?                   // → IncomeBandConfig
  earners       Int?
  dependents    Int?
  tuitionAmount Float?
  otherDebt     Float?
  accommodationStatus String?              // FAMILY_HOME | RENTED | CAMPUS | FREE
  accommodationCost Float?
  existingAidCoverage String?              // NONE | PARTIAL | FULL
  assistanceRequired  Boolean @default(false)
  consentToUseForMatching Boolean @default(false)   // explicit, separate from general consent
  weightSetVersion Int?                   // which FNS produced the stored score
  updatedAt    DateTime @updatedAt
}

model IncomeBandConfig {   // per-country, configurable
  id String @id @default(cuid())
  countryCode String
  currency String
  period String
  code String
  label String
  minAmount Float
  maxAmount Float?                          // null = open-ended top band
  @@unique([countryCode, currency, code])
}

model ScoringWeightSet {     // versioned, auditable
  id String @id @default(cuid())
  version Int @unique
  effectiveFrom DateTime
  weights String                            // JSON: factor → weight
  anchors String                            // JSON: normalisation anchors
  bands String                              // JSON: band cut-offs + labels
  note String?
  createdById String
  createdAt DateTime @default(now())
}

// ── Wellbeing ───────────────────────────────────────────────────────
model WellbeingCheckin {
  id String @id @default(cuid())
  userId String
  day String                                // YYYY-MM-DD (one-per-day is *not* enforced; multiple allowed)
  moodCode String                           // GOOD | OK | NEUTRAL | STRESSED | VERY_STRESSED
  stressLevel Int                           // 1..10
  sleepHours Float?
  note String?                              // ENCRYPTED, never read by admins, not in aggregates
  consentToAnalyze Boolean @default(false)
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

model CheckinFactor {                       // structured tags = ground-truth labels
  checkinId String
  factorCode String                         // EXAMS ASSIGNMENT MONEY CAREER FAMILY RELATIONSHIPS LONELINESS SLEEP OTHER
  @@id([checkinId, factorCode])
}

model ConcernAnalysis {
  id String @id @default(cuid())
  checkinId String @unique
  engineVersion String
  engineMode String                         // RULES | HYBRID
  scores String                             // JSON: category → 0..1
  dominantConcern String?
  confidence Float
  evidence String?                          // JSON: matched phrases
  createdAt DateTime @default(now())
}

model SafetyEscalation {                    // crisis pathway events (§6.3)
  id String @id @default(cuid())
  userId String
  checkinId String?
  triggerCode String                        // CRISIS_LANGUAGE | USER_REQUEST
  helplineShown Boolean
  consentedToContact Boolean @default(false)
  reviewedById String?
  resolvedAt DateTime?
  createdAt DateTime @default(now())
}

// ── Opportunities (Scholarship is a 1:1 specialisation) ────────────
model Opportunity {
  id String @id @default(cuid())
  type String                               // SCHOLARSHIP|INTERNSHIP|COMPETITION|FELLOWSHIP|EXCHANGE|COURSE
  slug String @unique
  title String
  provider String
  hostUniversityId String?
  countryCode String?
  city String?
  description String?
  categories String                         // JSON: WOMEN_IN_STEM, NEED_BASED, MERIT_BASED, ...
  eligibilitySummary String?
  deadline DateTime?
  startsAt DateTime?
  applyUrl String?
  isPaid Boolean @default(false)
  stipendMin Float?
  verificationStatus String @default("UNVERIFIED")  // UNVERIFIED|VERIFIED|OVERDUE|DISPUTED|CLOSED
  sourceUrl String                          // provenance — where this data came from
  lastVerifiedAt DateTime?
  verifiedById String?
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([type, isActive, deadline])
  @@index([verificationStatus, lastVerifiedAt])
}

model OpportunityCriterion {                // the rule engine's input
  id String @id @default(cuid())
  opportunityId String
  code String                               // MIN_CGPA | AGE | COUNTRY | DEGREE_LEVEL | FIELD | INCOME_NEED | ...
  operator String                           // GTE|LTE|BETWEEN|IN|NOT_IN|CONTAINS_ANY|EQ
  value String                              // JSON-encoded operand(s)
  required Boolean @default(true)           // false → soft score component, not a hard filter
  weight Float @default(0)                  // used when required = false
  label String?                             // admin-facing explanation of the rule
  @@index([opportunityId])
}

model OpportunityDocument {
  id String @id @default(cuid())
  opportunityId String
  docCode String                            // TRANSCRIPT | INCOME_CERTIFICATE | ID | RECOMMENDATION | ...
  label String
  required Boolean @default(true)
  note String?
  @@unique([opportunityId, docCode])
}

model Scholarship {                          // 1:1 extension
  id String @id @default(cuid())
  opportunityId String @unique
  tuitionCoverage String?                    // FULL | PARTIAL | PERCENT
  tuitionCoveragePercent Float?
  coversLiving Boolean @default(false)
  coversTravel Boolean @default(false)
  stipendAmount Float?
  currency String?
  renewable Boolean @default(false)
}

model MatchRun {                             // snapshot = auditability
  id String @id @default(cuid())
  userId String
  engineVersion String
  profileVersion Int
  inputHash String                          // cheap change detection for cache
  candidateCount Int
  eligibleCount Int
  durationMs Int?
  createdAt DateTime @default(now())
}

model ScholarshipMatch {
  id String @id @default(cuid())
  matchRunId String
  userId String
  opportunityId String
  eligible Boolean
  disqualifiedReasons String?               // JSON
  score Float?
  breakdown String?                         // JSON: component → value
  reasons String?                           // JSON: reason codes
  nearMiss Boolean @default(false)
  rank Int?
  @@unique([matchRunId, opportunityId])
  @@index([userId, eligible])
}

model Application {
  id String @id @default(cuid())
  userId String
  opportunityId String
  stage String @default("INTERESTED")        // INTERESTED|STARTED|SUBMITTED|RESULT|REJECTED|ACCEPTED
  completedDocs String?                     // JSON: docCode[]
  notes String?
  submittedAt DateTime?
  reminderAt DateTime?
  outcomeNote String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId, stage])
}

model SavedOpportunity { ... }               // @@unique([userId, opportunityId])

// ── Resources & human support ──────────────────────────────────────
model Resource {
  id String @id @default(cuid())
  category String                           // STUDY|SLEEP|MONEY|MENTAL_WELLBEING|ACADEMIC_ADVISING
  title String
  summary String
  url String?
  audienceTags String                       // JSON
  evidenceBased Boolean @default(false)
  reviewStatus String @default("PENDING")   // PENDING|APPROVED|REJECTED
  reviewDueAt DateTime?
  locale String @default("en")
}

model SupportService {                      // directory + crisis lines
  id String @id @default(cuid())
  type String                               // ACADEMIC_ADVISOR|COUNSELOR|FINANCIAL_AID|CAREER_CENTER|CRISIS_HOTLINE
  name String
  org String
  universityId String?
  countryCode String
  email String?; phone String?; website String?
  openingHours String?
  languages String                           // JSON
  isEmergency Boolean @default(false)
  verificationStatus String @default("UNVERIFIED")
  lastVerifiedAt DateTime?
}

// ── Community ───────────────────────────────────────────────────────
model CommunityPost {
  id String @id @default(cuid())
  authorId String?                          // may be null-ish-but-retained for abuse control
  isAnonymous Boolean @default(true)
  title String
  body String
  category String                           // ACADEMIC|FINANCIAL|CAREER|UNIVERSITY|GENERAL
  status String @default("PUBLISHED")        // PENDING|PUBLISHED|HIDDEN|REMOVED
  moderationScore Float?
  createdAt DateTime @default(now())
  @@index([category, status, createdAt])
}
model CommunityComment { ... }
model Report { id, reporterId, targetType, targetId, reason, status, resolution, resolvedById, createdAt }
model ModerationAction { id, actorId, action, targetType, targetId, metadata, createdAt }

// ── Platform ────────────────────────────────────────────────────────
model Notification { id, userId, type, title, body, link, channel, scheduledFor, sentAt, readAt }
model ConsentRecord { id, userId, scope, granted, policyVersion, createdAt   @@unique([userId, scope, policyVersion])
model AuditLog { id, actorId, action, entity, entityId, metadata, ip, userAgent, createdAt }
model DataRequest { id, userId, type /*EXPORT|DELETE*/, status, requestedAt, fulfilledAt, expiresAt }
model ImpersonationAudit — (only if admin impersonation is ever built; default OFF)
```

### 5.1 Indexing rules

- Every match/aggregate query path indexed (`[userId, eligible]`, `[type, isActive, deadline]`, `[verificationStatus, lastVerifiedAt]`).
- `WellbeingCheckin` uses `[userId, createdAt]` — never index by `moodCode`.
- No index on free-text `note`/`body` in v1 (privacy + SQLite).

---

## 6. Privacy, safety, ethics

**This section is a product requirement, not a nice-to-have.** It also happens to be the section that makes this project defensible academically and legally.

### 6.1 Data classification

| Class | Fields | Handling |
|---|---|---|
| **Restricted** | `dateOfBirth`, `FinancialProfile.*`, `WellbeingCheckin.note`, `CommunityPost.body`, `StudentProfile.achievements` | Encrypted at rest, least-privilege reads, excluded from every admin view, export/delete mandatory |
| **Personal** | name, email, university, CGPA, degree | Per-role access, visible to the student, visible to admin only as aggregates |
| **Public** | `Opportunity` (verified rows), `Resource`, `SupportService` | Cacheable |
| **Derived-sensitive** | FNS, concern scores, stress trends | Owning student only; aggregate-only beyond k=10 |

### 6.2 Student-facing commitments (surface these in the UI, not just the privacy page)

1. We never diagnose you and never call you poor.
2. Your journal text is not shown to staff. Ever.
3. Your financial band is not visible to other students.
4. Your data is used for matching only with your explicit consent, revocable.
5. Export everything, or delete everything, in one click.

### 6.3 Crisis pathway (invariant, must be tested)

Detect crisis language in check-in text → **immediately**:

1. Show the student's **country-specific** crisis lines (`SupportService.isEmergency`), prominently, above the fold.
2. Message: you are not in trouble for feeling this way; contacting these is free and confidential; if you are in immediate danger, contact your local emergency number.
3. Create a `SafetyEscalation` row (`consentedToContact = false`).
4. Staff see a **queue of un-consented escalations as alerts only** — never the text. The student can opt in to staff follow-up, which then requires an explicit audit-logged read.
5. Never block, gate, or delay the crisis screen behind an LLM call, a sign-up flow, or a network request.

Test this as a hard invariant in CI: any code path that renders check-in results must render the crisis surface when `triggerCode` is set.

### 6.4 Analytics consent & privacy by construction

- Admin dashboards read **only** from aggregate queries over `WellbeingCheckin`/`ConcernAnalysis`, never from `note`/`body`.
- Every aggregate query enforces **k-anonymity ≥ 10** (return `"<10 suppressed"`). Build this into a single `aggregateWithKAnonymity()` helper — a convention that isn't enforced is a convention that gets violated.
- Analytics consent is a separate, revocable `ConsentRecord` scope, default **off** for wellbeing data.
- Documented **retention**: check-in notes 12 months; financial profile until student deletes; inactive accounts anonymised after 24 months; audit logs 24 months; opportunity rows retained (they're public data).

### 6.5 Legal/compliance floor

- Explicit, granular, revocable consent with **policy versioning** (`ConsentRecord`).
- Right to export (machine-readable JSON) and to delete; `DataRequest` workflow with SLA.
- Cookie/tracking: analytics off by default, no third-party trackers on wellbeing or financial pages.
- Fairness: need-based recommendations must not be the *only* thing surfaced to low-income students — the ranker includes merit-based and general opportunities to avoid a self-reinforcing "poverty lane". Log this as a product invariant with a periodic aggregate check.
- Age: if under-18 students are in scope, parental-consent handling must be designed before launch, not after. **Recommendation: v1 is 18+.**

---

## 7. API surface & routes

### 7.1 Pages

```
/                          → redirect by role
(auth)/login · /register · /verify-email · /forgot-password
/onboarding                → 3 steps: personal → academic → financial (+ consent step)
/dashboard                 → stress, top concerns, matches, deadlines, next actions
/wellbeing/checkin         → daily check-in
/wellbeing/history         → trends
/wellbeing/safety          → crisis resources (also reachable from /emergency)
/financial                 → FNS breakdown, need-letter generator, budget tool
/opportunities             → browse + filter (type, country, deadline, need-based…)
/opportunities/[slug]      → detail, eligibility explanation, near-misses
/opportunities/[slug]/apply → document checklist + stage tracker
/saved · /applications     → pipeline
/community · /community/[postId]
/support                   → directory, filterable by type & country
/emergency                 → crisis lines (public, no auth)
/profile · /profile/privacy · /profile/data   → export & delete
/admin                     → aggregate dashboard
/admin/opportunities       → CRUD + CSV import + verification queue
/admin/scoring             → weight-set versions (new version = never mutate)
/admin/moderation          → reports queue + actions
/admin/resources           → resource review workflow
/admin/audit               → admin access log
```

### 7.2 Server-side entry points (all zod-validated, all authorised, all audit-logged where sensitive)

```
POST /api/auth/*                    (Better Auth / Auth.js)
POST /api/onboarding/*              profile upserts
POST /api/checkins                  create check-in → run classifier → escalate if needed
GET  /api/checkins/me               trends
GET  /api/financial/score           FNS + full breakdown + weightSetVersion
POST /api/financial/recompute       re-score after profile change (debounced)
POST /api/matches/run               rule engine run → MatchRun + matches (idempotent by inputHash)
GET  /api/matches/top               ranked, explained, with near-misses
POST /api/matches/impression        log impression/click → future ranking data
GET  /api/opportunities             filters: type, country, category, deadline, needBased, q
POST /api/applications              create/update stage; document checklist
GET  /api/applications/reminders    due + upcoming
GET  /api/support                   directory; ?emergency=true for crisis lines
GET  /api/community                 list (?category)
POST /api/community                 create (anonymous allowed; moderation score)
POST /api/reports                   report content
POST /api/admin/opportunities/import  CSV import w/ validation report
POST /api/admin/opportunities/[id]/verify  set verification + staleness
POST /api/admin/scoring/weights     create new version (never mutate in place)
GET  /api/admin/analytics           k-anonymised aggregates ONLY
POST /api/admin/data/export|delete  fulfilment
POST /api/cron/deadlines            reminders  (deadline < 14d / 3d)
POST /api/cron/verification-sweep   flag OVERDUE (lastVerifiedAt > 90d)
POST /api/cron/aggregates           refresh k-anonymised rollups
```

### 7.3 API conventions

- Mutations: **server actions** where the caller is a browser and the mutation is form-shaped; **route handlers** for cron/webhooks/imports/anything with a non-HTML client.
- Every handler: `session → role check → zod parse → domain call → audit if sensitive → typed result`. No handler contains business logic.
- Rate limits: login/password-reset tight, check-in + community moderate, match runs tight + cached, admin import tight.

---

## 8. Roles & permissions

| Capability | Student | Staff (advisor/counselor) | Admin |
|---|:---:|:---:|:---:|
| Own profile / financial profile / check-ins | ✅ | — | — |
| Own matches, applications, saved | ✅ | — | — |
| Browse opportunities & resources | ✅ | ✅ | ✅ |
| Read **any** check-in text or journal | ❌ | ❌ **never** | ❌ **never** |
| Read **any** student's FNS / financial profile | ❌ | ❌ **never** | ❌ **never** |
| See an un-consented safety escalation as an *alert only* | — | ✅ | ✅ |
| Respond to a consented escalation (audited) | opt-in | ✅ | ✅ |
| Aggregate wellbeing analytics (k≥10) | ❌ | ✅ | ✅ |
| Opportunity CRUD / import / verify | ❌ | ❌ | ✅ |
| Resource review | ❌ | suggest | ✅ |
| Moderation queue + actions | ❌ | ✅ | ✅ |
| Create scoring-weight versions | ❌ | ❌ | ✅ |
| Read audit log | ❌ | ❌ | ✅ |

Rule that must be true in code, not just in docs: **no role can read another student's restricted fields.** Enforce with a single `getRestrictedProfile()` accessor that throws unless `actorId === ownerId && actorRole === STUDENT`, plus an integration test that tries every role × every restricted field.

---

## 9. Testing & evaluation

Testing is what separates "AI app with prompts" from "engineering". Target ~80% on `domain/` and ~70% overall.

| Layer | What | Tools |
|---|---|---|
| **Unit** | Every `domain/` function: score boundaries (exact anchors), band cut-offs, negation handling in the lexicon, hard-filter operators, near-miss logic, weight renormalisation when inputs are missing, freshness factors | Vitest, table-driven cases |
| **Property** | FNS ∈ [0,100] for any input; more earners ⇒ need ≤ ; older deadline ⇒ urgency ≥ ; score invariant to criterion order; engine idempotent for same `inputHash` | fast-check |
| **Golden** | Eligiblity decisions against a hand-labelled set — the regression guard for data edits | Vitest snapshots |
| **Integration** | Route handlers with DB: authz matrix (role × field), consent enforcement, crisis invariant, export/delete completeness | Vitest + temp SQLite |
| **E2E** | Onboarding → check-in → matches → apply; admin import → verify → student sees it | Playwright |
| **Evaluation** | The metrics in §1.5 | `eval/` scripts → `docs/EVAL.md` |

### 9.1 Evaluation harness

```
eval/
  fixtures/
    opportunities.json        # 60 curated opportunities w/ criteria
    students.json             # 40 synthetic student profiles (no real PII — synthetic only)
    relevance.json            # expert-labelled relevance 0-3 per (student, opportunity)
    checkins.json             # 150 labelled notes → 9 concern categories (synthetic + consented real)
  run-matching-eval.ts        # NDCG@10, MRR, coverage, hard-filter violations (must be 0)
  run-classifier-eval.ts      # per-category P/R/F1, macro-F1, confusion matrix
  run-safety-eval.ts          # crisis recall (must be 1.00), clinical-term leak check (must be 0)
```

Gates in CI:
1. **Hard-filter violations = 0.** Non-negotiable. A false "you're eligible" sends a student to a dead end and damages trust.
2. **Crisis recall = 1.00** on the crisis fixture set.
3. **Clinical-term leak = 0** (scan all user-visible LLM output against a banned-term list).
4. Classifier macro-F1 ≥ 0.75 (structured tags alone should already clear this; free text is where it gets interesting).
5. NDCG@10 ≥ 0.75.

Publishing these numbers in `docs/EVAL.md` — with the fixture sizes honestly stated — is a large part of what makes this a strong academic submission.

---

## 10. Ops, security, cost

### 10.1 Security baseline

- Passwords: Argon2id (via the auth library). Rate-limit login + reset by IP and email. Generic error copy (no user-enumeration).
- Sessions: httpOnly, secure, sameSite=lax, rotation, server-side revocation. Require email verification before financial features.
- CSRF: framework default for server actions; explicit origin checks on custom route handlers.
- Security headers: CSP (strict, no `unsafe-inline` in prod), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- Input: zod at every boundary; HTML-escape community content on render; cap body length.
- Secrets: env only, never in the repo, `.env.example` documented, production secret manager.
- Audit log on: admin CRUD on opportunities, weight-version creation, moderation actions, any consented escalation read, export/delete fulfilment.
- Backups: Postgres daily snapshots (PITR when paid); rehearse a restore before launch.

### 10.2 Observability

- Structured logs with `requestId` + `userId`; **never log `note`, `body`, or financial values** (redaction at the logger, not at the call site).
- Error tracking (Sentry) with the same redaction.
- Product analytics: first-party, consent-gated. Event taxonomy: `checkin_completed`, `concern_flagged`, `match_run`, `match_impression`, `match_click`, `application_stage_changed`, `deadline_reminder_sent`, `crisis_escalation_shown`.

### 10.3 Cost at seed scale (verify current pricing)

| Item | v1 choice | Cost |
|---|---|---|
| Hosting | Vercel Hobby | $0 |
| DB | Neon/Supabase free tier | $0 |
| Auth | Better Auth, self-hosted | $0 |
| LLM | Optional, off by default, hard token caps | ~$0–5/mo |
| Email | Resend free tier | $0 |
| Errors | Sentry free | $0 |
| **Total floor** | | **≈ $0/mo** |

That is a genuine advantage of the rules-first decision: **the product is free to run at seed scale, and the LLM is an enhancement rather than a cost centre.**

---

## 11. Milestones

Roughly 12–14 weeks for one competent full-time developer, assuming no framework surprises.

| # | Milestone | Contents | Definition of done |
|---|---|---|---|
| **M0** | Foundations (3–4 days) | Next.js + TS strict + Tailwind + Prisma + SQLite + Vitest + lint/CI + auth + `StudentProfile` | `npm run dev` up; register→login→profile persists; CI green; empty test for `domain/` wired |
| **M1** | Profiles & FNS (1 wk) | Onboarding (3 steps + consent), `FinancialProfile`, `IncomeBandConfig`, `ScoringWeightSet`, FNS engine + unit tests + `/financial` page with breakdown | FNS passes property tests; every input changeable; breakdown explains every point; first version recorded |
| **M2** | Opportunity DB & eligibility (2 wks) | `Opportunity`/`Scholarship`/`Criterion`/`Document`, admin CRUD + CSV import + verification workflow, **seed ≥ 50 real opportunities with sources**, eligibility engine + scorer + reasons | Seeded DB with provenance on every row; a criterion edit changes matches correctly; 100% of test fixtures evaluate as expected |
| **M3** | Wellbeing check-in & classifier (1.5 wks) | Check-in UI, `ConcernAnalysis`, lexicon classifier, trend engine, **crisis pathway + tests**, `/dashboard` | Macro-F1 ≥ 0.75 on fixtures; crisis recall = 1.00; student sees trends |
| **M4** | Matching + pipeline (1.5 wks) | Match runs + caching, ranked matches with near-misses, application tracker, deadline reminders (cron) + notifications, `docs/EVAL.md` v1 | NDCG@10 ≥ 0.75; hard-filter violations = 0; a demo user with "no money" finds real, correct funding |
| **M5** | Community, support, admin (2 wks) | Anonymous threads + moderation + reports, resource library, support directory, aggregate-only admin dashboard, audit log, k-anonymity helper | Authz matrix tests pass; admin can see demand but zero restricted fields; report → hide → audit trail works |
| **M6** | Trust & launch (1–2 wks) | Consent UX, export/delete, retention job, security headers, backups + restore rehearsal, rate limits, seed demo script, docs, LLM enrichment (optional, off by default) | Full security checklist; restore rehearsed; demo script runs end-to-end; EVAL published |

**Cut order if you slip** (in this order — never cut 1–3): M6 LLM enrichment → M5 community → M6 retention automation → M4 near-miss UX polish → M2 admin import UI (replace with CSV-by-hand) → M3 sleep tracking. M0–M4 are the irreducible core.

### 11.1 Phase 1 (MVP) scope = M0 + M1 + M2 + M3 + M4 core

Which is exactly: auth, profiles, FNS, check-in, classifier, opportunity DB + admin CRUD/import, eligibility engine, dashboard, ranked matches, application tracker. **That alone is a working, demonstrable, defensible product** — and it is the phase you should build next.

---

## 12. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Stale/wrong scholarship data** — deadlines pass, criteria change. Biggest trust-killer. | High | Critical | `verificationStatus` + `lastVerifiedAt` on every row; `OVERDUE` rows demoted in ranking (`freshnessFactor`); weekly sweep; student-visible "verified on <date>"; admin re-verification queue |
| R2 | **Sensitive financial data leak** | Low | Critical | Encrypted restricted fields; single accessor pattern; authz matrix tests; logger redaction; no restricted field in any admin query; penetration-test the export path |
| R3 | **Wellbeing harm** — a student in crisis gets a chatbot | Medium | Critical | Crisis pathway invariant (§6.3), no clinical output, helpline-first rendering, crisis-recall test gate, human escalation queue |
| R4 | **False eligibility** → wasted student time, reputational damage | Medium | High | Hard-filter-first architecture; violations = 0 is a CI gate; every criterion is admin-editable data, reviewable before publishing; near-miss messaging instead of dead ends |
| R5 | **LLM hallucination** inventing scholarships | Medium (if LLM enabled) | High | LLM receives *only* retrieved DB rows; code-level check rejects any returned opportunity name absent from the input; LLM writes prose, never facts; rules engine is the source of truth |
| R6 | **Scope explosion** (16 tables, 5 phases, a mobile app) | High | High | §1.4 anti-feature list; cut order in §11; one milestone at a time; "deferred" is a decision, not a failure |
| R7 | **Privacy-by-convention erodes** | High | High | `aggregateWithKAnonymity()` helper; restricted-field accessor that *throws*; CI test asserting no admin route reads restricted models; review checklist item |
| R8 | **Moderation failure** in community | Medium | Medium | Structured tags + heuristic risk score → pending queue; report + 1-click hide; auto-hide on N reports; staff queue; DMs/chat excluded from v1 |
| R9 | **SQLite → Postgres migration pain** | Low | Medium | Repository layer; no SQLite-only features; migration rehearsed in M6 |
| R10 | **Auth library churn** (`next-auth` v5 still beta) | Medium | Medium | Prefer Better Auth (stable, actively maintained); adapter isolated in one module so it can be swapped |
| R11 | **Recommendation fairness** — students in a permanent "poverty lane" | Medium | Medium | Include merit-based + general opportunities in every result set; fairness aggregate check on ranking distribution by FNS band |
| R12 | **Under-18 students** | Low | High | v1 is 18+; enforce at signup; document the decision |

---

## 13. Repo layout

```
student-support-system/
├─ docs/
│  ├─ PLAN.md                     ← this file
│  ├─ EVAL.md                     ← published evaluation results
│  ├─ THREAT-MODEL.md
│  ├─ PRIVACY.md                   ← plain-language privacy notice
│  └─ adr/                        ← numbered architecture decision records
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                      ← synthetic students + 50+ sourced opportunities
├─ src/
│  ├─ app/
│  │  ├─ (auth)/  (student)/  (admin)/
│  │  ├─ api/
│  │  └─ emergency/
│  ├─ domain/                     ← PURE, no I/O, no framework imports
│  │  ├─ financial/   (score.ts, anchors.ts, bands.ts, need-letter.ts)
│  │  ├─ wellbeing/   (classifier/lexicon.ts, classifier/index.ts, crisis.ts, trend.ts)
│  │  ├─ matching/    (filters.ts, scorer.ts, reasons.ts, explainer.ts, ranker.ts)
│  │  └─ shared/      (result.ts, errors.ts)
│  ├─ server/                     ← the only place Prisma is imported
│  │  ├─ db/  (client.ts, repositories/*.ts)
│  │  ├─ auth/ (session.ts, rbac.ts)
│  │  ├─ ai/  (adapter.ts, prompts.ts, guardrails.ts)
│  │  └─ services/ (matching.service.ts, checkin.service.ts, ...)
│  ├─ components/  ui/  lib/
│  └─ config/  (criteria.ts, lexicon.ts, scoring-presets.ts, bands.ts)  ← tunable, versioned
├─ eval/
├─ tests/{unit,integration,e2e}/
└─ .github/workflows/ci.yml
```

Import rules (enforce with an ESLint `no-restricted-imports` rule — this is what keeps the layering honest):
- `domain/**` must not import `server/**`, `next/**`, or `@prisma/client`
- `@prisma/client` may only be imported under `src/server/db/**`
- `app/**` must not import `@prisma/client` directly

---

## 14. Immediate next steps (Phase 1, task order)

| # | Task | Notes |
|---|---|---|
| 1 | `git init`, `.gitignore`, `README.md` | |
| 2 | Scaffold Next.js 16 + TS strict + Tailwind 4 | Confirm `middleware`/`proxy` file convention in Next 16 docs |
| 3 | Add Prisma **7.10.0** (stable tag, not `latest` = 8.0.0-rc) + SQLite; confirm adapter requirements | Verify SQLite adapter setup at install |
| 4 | ESLint layering rules + Vitest + CI skeleton | Makes the architecture self-enforcing from day one |
| 5 | Auth (Better Auth) + role model + session + RBAC helpers | |
| 6 | Prisma schema: `User`, `StudentProfile`, `AcademicProfile`, `FinancialProfile`, `IncomeBandConfig`, `ScoringWeightSet`, `AuditLog`, `ConsentRecord` | Migration to Postgres later touches nothing here |
| 7 | `domain/financial/` + unit + property tests | **First pure domain slice — proves the architecture** |
| 8 | `/financial` page with score breakdown + need-letter generator | Never show the raw word "poor" |
| 9 | Opportunity schema + admin CRUD | |
| 10 | **Seed ≥ 50 real opportunities with `sourceUrl` + `lastVerifiedAt`** | Real data or the demo is worthless; this is a chunk of work — start early |
| 11 | `domain/matching/` filters + scorer + reasons + tests | |
| 12 | Match run service + `/opportunities` + detail with near-misses | |
| 13 | Check-in + `domain/wellbeing/` classifier + crisis pathway | |
| 14 | Dashboard + trends | |
| 15 | Applications + deadline cron | |
| 16 | `eval/` harness + `docs/EVAL.md` v1 | |

**Start with task 10 in parallel** (research while code happens). 50 verified opportunities is what separates a demo from a demo people can trust.

---

## 15. Decisions log & open questions

### Decided (2026-10-05)

| # | Decision | Rationale |
|---|---|---|
| D1 | Single Next.js deployable; no Express API in v1 | Ops cost without user benefit; revisit at the trigger in §3.2 |
| D2 | SQLite dev → Postgres prod, all DB access in one layer | No infra blocker on day one; cheap migration |
| D3 | Rules-first eligibility; LLM for explanation only | Deterministic, auditable, free to run, LLM-optional |
| D4 | Prisma stable `7.10.0`, not the `8.0.0-rc` `latest` tag | No RCs for a product's data layer |
| D5 | Better Auth preferred over `next-auth@5` beta | Stable, actively maintained, 2FA/passkeys, Prisma adapter |
| D6 | Financial data is banded at signup; no document upload in v1 | Minimisation; documents are a v2 feature with much higher risk |
| D7 | Admins never read journal text or individual financial profiles | Non-negotiable product invariant, not a setting |
| D8 | 18+ only in v1 | Simplifies consent; parental-consent design deferred |
| D9 | `Opportunity` is the base table; `Scholarship` is a 1:1 extension | Scholarships, internships, fellowships share one pipeline |
| D10 | Scoring weights are versioned rows, never mutable config | Auditability + safe model improvement |

### Open questions — answers change the plan

1. **Which country/currency is v1 for?** Income bands, tuition anchors, universities and helplines are all country-specific. (Plan assumes a configurable multi-country design with one launch country.)
2. **Real partner data or public data?** Do you have agreements with any university, NGO or scholarship provider? Real verified data would be a genuine moat.
3. **Monetisation intent?** Never charge students for need-based funding access — that would be ethically indefensible. If there's a business, the natural candidates are B2B2C (universities buying the insight dashboard) or employer/institution partnerships. **Decide before building admin analytics**, because it shapes the data model.
4. **Is there a university partner to onboard first?** One real university + its counselors + its opportunities would make this dramatically more credible and more testable.
5. **Timeline / team?** Single developer or a team? Any hard deadline (submission, demo day)?
6. **Community moderation:** volunteer student moderators, or staff-only for v1? Affects role design.
7. **Accountability model:** does the university/counselor see a student's escalation *with* consent, or only an anonymous alert? Affects the trust promise in §6.
