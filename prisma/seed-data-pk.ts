/**
 * Pakistan seed data — PUBLIC data only.
 *
 * ⚠️ HONESTY NOTE, READ BEFORE USING THIS IN A DEMO OR PRESENTATION
 * Every listing below is seeded as `verificationStatus: "UNVERIFIED"`, which is
 * deliberate. These are real, publicly-run programmes that Pakistani students
 * genuinely use, but:
 *
 *   1. DEADLINES ARE INTENTIONALLY NULL. I will not invent application
 *      deadlines. A wrong deadline is worse than a missing one: it either
 *      wastes a student's time or destroys trust in every other date we show.
 *      Fill `deadline` from each `sourceUrl` before launch (plan risk R1).
 *   2. ELIGIBILITY CRITERIA ARE INDICATIVE. The min-CGPA and age values below
 *      are reasonable starting points, NOT verified official requirements.
 *      The matching engine treats them as data an admin must confirm.
 *   3. The matching engine already reflects this: unverified rows get a 0.75
 *      freshness factor and an `UNVERIFIED_SOURCE` reason, so the UI can warn
 *      the student to confirm on the official page.
 *
 * This is exactly the workflow the plan describes — the database holds claims
 * with provenance, and verification is a separate, visible state.
 */

export type SeedOpportunity = {
  slug: string;
  type: "SCHOLARSHIP" | "INTERNSHIP" | "COMPETITION" | "COURSE" | "FELLOWSHIP" | "EXCHANGE";
  title: string;
  provider: string;
  countryCode: string | null;
  description: string;
  categories: string[];
  applyUrl: string | null;
  sourceUrl: string;
  isPaid: boolean;
  stipendMin: number | null;
  isNeedBased: boolean;
  isMeritBased: boolean;
  tuitionCoverage: "FULL" | "PARTIAL" | "PERCENT" | null;
  tuitionCoveragePercent: number | null;
  coversLiving: boolean;
  coversTravel: boolean;
  /**
   * Full closing instant, written with an explicit offset.
   *
   * The offset is mandatory because it records *whose* wall clock the deadline
   * is on. HEC publishes "20 Oct 2026, 4:00 PM" — that is PKT, i.e. 11:00 UTC.
   * Writing `20 Oct 2026` and defaulting to end-of-day silently hands a student
   * eight hours that do not exist, which is exactly how an application gets
   * missed. Where an official page gives a date but no time, the entry says so
   * in the description and 23:59 local is used.
   *
   * Left null wherever the current cycle date is not confirmed.
   */
  deadline?: string | null;
  /**
   * VERIFIED only where criteria AND deadline came from the official page.
   * Anything omitted here defaults to UNVERIFIED in the seed script — the safe
   * direction, since unverified rows are demoted and badged.
   */
  verificationStatus?: "VERIFIED" | "UNVERIFIED";
  lastVerifiedAt?: string | null;
  criteria: { code: string; operator: string; value: Record<string, unknown>; label?: string }[];
  documents: { docCode: string; label: string; required: boolean }[];
};

const note = "Indicative criteria — confirm current requirements on the official page before applying.";

/**
 * ── VERIFIED, official-source programmes ────────────────────────────────────
 * Every field below came from hec.gov.pk on 2026-10-05. These are the channels
 * Pakistani students actually apply through, so the criteria are real:
 *
 *  · HEC Commonwealth (Masters & PhD) — HEC deadline 20 Oct 2026 4:00pm;
 *    CSC closes the same day; 26 Masters + 30 PhD nominations; Pakistani/AJK
 *    national and permanent resident; dual nationals excluded; first division
 *    in the terminal degree; HAT score ≥ 60/100 mandatory (HAT-I..IV only).
 *  · HEC Overseas Phase-III Batch-IV — deadline 28 Aug 2026 (now closed);
 *    MS/MPhil and PhD only; top-200 QS/THE universities; HAT ≥ 60.
 *  · Heydar Aliyev Grant (Azerbaijan) via HEC — deadline 20 Mar 2026 (closed);
 *    3 slots; age limits vary by degree level, so no single MAX_AGE is applied.
 *  · HEC Need-Based Scholarship — monthly family income ≤ Rs 45,000, not for
 *    self-finance students; administered by the student's own university.
 *  · Stipendium Hungaricum via HEC — documents due 15 Jan 2026 (closed);
 *    Pakistani/AJK citizens, 18 on or before 31 Aug 2026, no upper age limit.
 *
 * Deadlines that have passed are left in place on purpose: the engine reports
 * them as closed, which is the honest answer and exercises that path.
 */
export const PK_HEC_PROGRAMMES: SeedOpportunity[] = [
  {
    slug: "hec-commonwealth-masters-phd-2027",
    type: "SCHOLARSHIP",
    title: "HEC — Commonwealth Scholarships for Masters & PhD (2027-28)",
    provider: "Higher Education Commission of Pakistan / CSC",
    countryCode: "GB",
    description:
      "HEC-nominated Commonwealth awards for full-time taught Master's and PhD study at UK universities, starting September/October 2027. Covers tuition, living costs and travel. 26 Master's and 30 PhD nominations are offered. Applicants must be Pakistani/AJ&K nationals and permanent residents (dual nationals are not eligible), hold a first division in their terminal degree, and provide a HAT score of at least 60/100 — only general HAT tests are accepted.",
    categories: ["FULLY_FUNDED", "MERIT_BASED", "HEC_NOMINATED"],
    applyUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/lao/cwgs/",
    sourceUrl:
      "https://www.hec.gov.pk/english/scholarshipsgrants/lao/cwgs/Pages/Eligibility-Criteria.aspx",
    isPaid: true,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    deadline: "2026-10-20T16:00:00+05:00",
    verificationStatus: "VERIFIED",
    lastVerifiedAt: "2026-10-05",
    criteria: [
      {
        code: "NATIONALITY",
        operator: "IN",
        value: { in: ["PK"] },
        label: "Pakistani/AJ&K national and permanent resident",
      },
      {
        code: "DEGREE_LEVEL",
        operator: "IN",
        value: { in: ["MASTERS", "PHD"] },
        label: "Master's or PhD applicants",
      },
      {
        code: "MIN_HAT",
        operator: "GTE",
        value: { gte: 60, scale: 100 },
        label: "HAT test score ≥ 60/100",
      },
    ],
    documents: [
      { docCode: "HAT_RESULT", label: "HAT test result (≥ 60)", required: true },
      { docCode: "DEGREE", label: "Degree certificate (first division)", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "CNIC", label: "CNIC", required: true },
      { docCode: "REFERENCE", label: "References", required: false },
    ],
  },
  {
    slug: "hec-overseas-phase3-batch4",
    type: "SCHOLARSHIP",
    title: "HEC — Overseas Scholarships for MS/MPhil & PhD (Phase-III, Batch-IV)",
    provider: "Higher Education Commission of Pakistan",
    countryCode: null,
    description:
      "HEC's fully funded overseas programme for MS/MPhil and PhD study at the top 200 QS/THE ranked universities, covering tuition, living allowance and airfare. Open to Pakistani/AJ&K nationals with a qualifying HAT score. The 2026 batch has closed.",
    categories: ["FULLY_FUNDED", "MERIT_BASED", "HEC_NOMINATED"],
    applyUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/InternationalScholarships.aspx",
    sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/InternationalScholarships.aspx",
    isPaid: true,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    deadline: "2026-08-28T23:59:00+05:00",
    verificationStatus: "VERIFIED",
    lastVerifiedAt: "2026-10-05",
    criteria: [
      { code: "NATIONALITY", operator: "IN", value: { in: ["PK"] }, label: "Pakistani/AJ&K nationals" },
      {
        code: "DEGREE_LEVEL",
        operator: "IN",
        value: { in: ["MASTERS", "PHD"] },
        label: "MS/MPhil or PhD applicants",
      },
      { code: "MIN_HAT", operator: "GTE", value: { gte: 60, scale: 100 }, label: "HAT test score ≥ 60" },
    ],
    documents: [
      { docCode: "HAT_RESULT", label: "HAT test result", required: true },
      { docCode: "DEGREE", label: "Degree certificate", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "CNIC", label: "CNIC", required: true },
    ],
  },
  {
    slug: "hec-need-based-domestic",
    type: "SCHOLARSHIP",
    title: "HEC Need-Based Scholarship (domestic)",
    provider: "Higher Education Commission of Pakistan — via your university",
    countryCode: "PK",
    description:
      "Financial assistance for students whose household income is low. Eligibility is set by your own university, but the HEC framework requires monthly family income of Rs 45,000 or less, and excludes self-finance students. Applications are usually handled by the university's financial aid office, which decides deadlines — check with them directly.",
    categories: ["NEED_BASED", "DOMESTIC"],
    applyUrl: "https://www.hec.gov.pk/",
    sourceUrl: "https://www.hec.gov.pk/",
    isPaid: true,
    stipendMin: null,
    isNeedBased: true,
    isMeritBased: false,
    tuitionCoverage: "PERCENT",
    tuitionCoveragePercent: 50,
    coversLiving: false,
    coversTravel: false,
    // Deadline is set per university, so it is deliberately not asserted here.
    deadline: null,
    verificationStatus: "VERIFIED",
    lastVerifiedAt: "2026-10-05",
    criteria: [
      { code: "NATIONALITY", operator: "IN", value: { in: ["PK"] }, label: "Pakistani students" },
      {
        code: "MAX_HOUSEHOLD_INCOME",
        operator: "LTE",
        value: { lte: 45_000 },
        label: "Monthly family income ≤ Rs 45,000",
      },
    ],
    documents: [
      { docCode: "CNIC", label: "CNIC", required: true },
      { docCode: "UTILITY_BILL", label: "Utility bill", required: true },
      { docCode: "RENT_AGREEMENT", label: "Rent agreement", required: false },
      { docCode: "FEE_RECEIPT", label: "Fee receipt", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
    ],
  },
  {
    slug: "hec-heydar-aliyev-grant-azerbaijan",
    type: "SCHOLARSHIP",
    title: "Heydar Aliyev International Educational Grant (Azerbaijan)",
    provider: "Higher Education Commission of Pakistan / Azerbaijan",
    countryCode: "AZ",
    description:
      "Three fully funded slots (one bachelor's, one master's, one doctoral) awarded through HEC. Age limits apply and differ by degree level, so check the current call before applying. A HAT or USAT score obtained on or after the call date is required. The 2026 round has closed.",
    categories: ["FULLY_FUNDED", "HEC_NOMINATED"],
    applyUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/InternationalScholarships.aspx",
    sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/InternationalScholarships.aspx",
    isPaid: true,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    deadline: "2026-03-20T23:59:00+05:00",
    verificationStatus: "VERIFIED",
    lastVerifiedAt: "2026-10-05",
    criteria: [
      { code: "NATIONALITY", operator: "IN", value: { in: ["PK"] }, label: "Pakistani/AJ&K nationals" },
      {
        code: "DEGREE_LEVEL",
        operator: "IN",
        value: { in: ["UNDERGRADUATE", "MASTERS", "PHD"] },
        label: "Bachelor's, Master's or doctoral applicants",
      },
    ],
    documents: [
      { docCode: "HAT_RESULT", label: "HAT / USAT result", required: true },
      { docCode: "DEGREE", label: "Degree certificate", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "PASSPORT", label: "Passport", required: true },
    ],
  },
  {
    slug: "hec-stipendium-hungaricum",
    type: "SCHOLARSHIP",
    title: "Stipendium Hungaricum Scholarship (via HEC)",
    provider: "Hungarian Ministry of Foreign Affairs and Trade / HEC",
    countryCode: "HU",
    description:
      "Hungarian government scholarship covering tuition and a monthly stipend. Open to Pakistani/AJ&K citizens with no upper age limit; applicants must be 18 on or before the published cut-off date. Recipients may be asked to serve in Pakistan after graduation. The current HEC document deadline has passed.",
    categories: ["FULLY_FUNDED", "MERIT_BASED"],
    applyUrl: "https://stipendiumhungaricum.hu/",
    sourceUrl: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/InternationalScholarships.aspx",
    isPaid: true,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: false,
    deadline: "2026-01-15T23:59:00+05:00",
    verificationStatus: "VERIFIED",
    lastVerifiedAt: "2026-10-05",
    criteria: [
      { code: "NATIONALITY", operator: "IN", value: { in: ["PK"] }, label: "Pakistani/AJ&K citizens" },
      { code: "MIN_AGE", operator: "GTE", value: { gte: 18 }, label: "Aged 18 by the published cut-off" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "LANGUAGE_CERT", label: "Language certificate", required: false },
    ],
  },
];

export const PK_OPPORTUNITIES: SeedOpportunity[] = [
  {
    slug: "hec-need-based-scholarship",
    type: "SCHOLARSHIP",
    title: "HEC Need-Based Scholarship (Pakistan)",
    provider: "Higher Education Commission of Pakistan",
    countryCode: "PK",
    description:
      "Financial assistance from the Higher Education Commission for Pakistani students with financial need. Study in Pakistan at a HEC-recognised institution. " +
      note,
    categories: ["NEED_BASED"],
    applyUrl: "https://www.hec.gov.pk/",
    sourceUrl: "https://www.hec.gov.pk/",
    isPaid: true,
    stipendMin: null,
    isNeedBased: true,
    isMeritBased: false,
    tuitionCoverage: "PERCENT",
    tuitionCoveragePercent: 50,
    coversLiving: false,
    coversTravel: false,
    criteria: [
      { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, label: "Pakistani residents" },
      { code: "INCOME_NEED", operator: "GTE", value: { gte: 55, scale: 100 }, label: "Financial need above threshold" },
    ],
    documents: [
      { docCode: "CNIC", label: "CNIC / national ID", required: true },
      { docCode: "INCOME_CERTIFICATE", label: "Income certificate", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript / result card", required: true },
      { docCode: "ADMISSION_LETTER", label: "Admission letter", required: true },
    ],
  },
  {
    slug: "saarc-scholarship",
    type: "SCHOLARSHIP",
    title: "SAARC Regional Scholarship",
    provider: "SAARC Secretariat / regional universities",
    countryCode: null,
    description:
      "Scholarships for nationals of SAARC member states, including Pakistan, to study at participating institutions in the region. " + note,
    categories: ["REGIONAL", "MERIT_BASED"],
    applyUrl: null,
    sourceUrl: "https://www.saarc-sec.org/",
    isPaid: false,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "PARTIAL",
    tuitionCoveragePercent: null,
    coversLiving: false,
    coversTravel: false,
    criteria: [
      { code: "NATIONALITY", operator: "IN", value: { in: ["PK", "IN", "BD", "NP", "LK", "MV", "AF"] }, label: "SAARC nationals" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport copy", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
    ],
  },
  {
    slug: "turkiye-government-scholarship",
    type: "SCHOLARSHIP",
    title: "Türkiye Government Scholarship",
    provider: "Republic of Türkiye (YÖK / Presidency)",
    countryCode: "TR",
    description:
      "Fully funded Turkish government scholarships covering tuition, accommodation and a monthly stipend for international students, with dedicated quotas for Pakistan. " +
      note,
    categories: ["FULLY_FUNDED", "DEVELOPING_COUNTRIES"],
    applyUrl: "https://yurtlar.yok.gov.tr/",
    sourceUrl: "https://yurtlar.yok.gov.tr/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    criteria: [
      { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, label: "Open to Pakistani nationals" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
      { code: "MIN_AGE", operator: "GTE", value: { gte: 16 }, label: "Minimum age" },
      { code: "MAX_AGE", operator: "LTE", value: { lte: 30 }, label: "Maximum age" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "ID", label: "CNIC", required: true },
    ],
  },
  {
    slug: "chinese-government-scholarship",
    type: "SCHOLARSHIP",
    title: "Chinese Government Scholarship (CSC)",
    provider: "China Scholarship Council",
    countryCode: "CN",
    description:
      "Government scholarships covering tuition, accommodation, insurance and a stipend, with places reserved for Pakistani students through the Pakistan-China pathway. " +
      note,
    categories: ["FULLY_FUNDED", "DEVELOPING_COUNTRIES"],
    applyUrl: "https://www.csc.edu.cn/",
    sourceUrl: "https://www.csc.edu.cn/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: false,
    criteria: [
      { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, label: "Open to Pakistani nationals" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
      { code: "MAX_AGE", operator: "LTE", value: { lte: 25 }, label: "Maximum age" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "RECOMMENDATION", label: "Recommendation letter", required: true },
    ],
  },
  {
    slug: "stipendium-hungaricum",
    type: "SCHOLARSHIP",
    title: "Stipendium Hungaricum Scholarship",
    provider: "Hungarian Ministry of Foreign Affairs and Trade",
    countryCode: "HU",
    description:
      "Hungarian government scholarship covering tuition and a monthly stipend, with both merit and need-based tracks open to Pakistani students. " + note,
    categories: ["FULLY_FUNDED", "NEED_BASED", "MERIT_BASED"],
    applyUrl: "https://stipendiumhungaricum.hu/",
    sourceUrl: "https://stipendiumhungaricum.hu/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: true,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: false,
    criteria: [
      { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, label: "Open to Pakistani nationals" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "RECOMMENDATION", label: "Recommendation letter", required: true },
    ],
  },
  {
    slug: "daad-development-related-programmes",
    type: "SCHOLARSHIP",
    title: "DAAD Development-Related Postgraduate Programmes",
    provider: "German Academic Exchange Service (DAAD)",
    countryCode: "DE",
    description:
      "Postgraduate study and research scholarships from DAAD, including development-related programmes open to applicants from partner countries. " + note,
    categories: ["MERIT_BASED", "DEVELOPING_COUNTRIES"],
    applyUrl: "https://www.daad.de/",
    sourceUrl: "https://www.daad.de/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    criteria: [
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
      { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["MASTERS", "PHD"] }, label: "Postgraduate applicants" },
      { code: "MAX_AGE", operator: "LTE", value: { lte: 32 }, label: "Maximum age" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "CV", label: "CV", required: true },
      { docCode: "RECOMMENDATION", label: "Recommendation letters", required: true },
    ],
  },
  {
    slug: "erasmus-mundus-joint-masters",
    type: "SCHOLARSHIP",
    title: "Erasmus Mundus Joint Master Degrees",
    provider: "European Commission",
    countryCode: null,
    description:
      "Consortium master's programmes with full funding including tuition, travel and living allowance. Open to students from all partner countries including Pakistan. " +
      note,
    categories: ["FULLY_FUNDED", "MERIT_BASED"],
    applyUrl: "https://erasmus-plus.ec.europa.eu/etrasmus-mundus",
    sourceUrl: "https://erasmus-plus.ec.europa.eu/etrasmus-mundus",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    criteria: [
      { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["UNDERGRADUATE", "MASTERS"] }, label: "Bachelor's degree required" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "DEGREE", label: "Degree certificate", required: true },
      { docCode: "CV", label: "CV", required: true },
      { docCode: "RECOMMENDATION", label: "Recommendation letters", required: true },
    ],
  },
  {
    slug: "commonwealth-masters-scholarship",
    type: "SCHOLARSHIP",
    title: "Commonwealth Master's Scholarships",
    provider: "Commonwealth Scholarship Commission",
    countryCode: null,
    description:
      "UK government-funded master's scholarships covering tuition, living costs and travel, with awards available to candidates from Pakistan. " + note,
    categories: ["FULLY_FUNDED", "NEED_BASED"],
    applyUrl: "https://www.commonwealthscholarships.org/",
    sourceUrl: "https://www.commonwealthscholarships.org/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: true,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    criteria: [
      { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["MASTERS"] }, label: "Master's applicants" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
      { code: "MIN_AGE", operator: "GTE", value: { gte: 18 }, label: "Minimum age" },
    ],
    documents: [
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "DEGREE", label: "Degree certificate", required: true },
      { docCode: "REFERENCE", label: "References", required: true },
      { docCode: "ID", label: "CNIC / passport", required: true },
    ],
  },
  {
    slug: "chevening-scholarship",
    type: "SCHOLARSHIP",
    title: "Chevening Scholarships (UK Government)",
    provider: "Foreign, Commonwealth & Development Office",
    countryCode: "GB",
    description:
      "UK government scholarships for one-year master's degrees covering tuition, living costs and travel, open to Pakistani professionals with leadership potential. " +
      note,
    categories: ["FULLY_FUNDED", "MERIT_BASED"],
    applyUrl: "https://www.chevening.com/",
    sourceUrl: "https://www.chevening.com/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    criteria: [
      { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["MASTERS"] }, label: "Master's applicants" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
      { code: "MIN_AGE", operator: "GTE", value: { gte: 21 }, label: "Minimum age at application" },
    ],
    documents: [
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "DEGREE", label: "Degree certificate", required: true },
      { docCode: "REFERENCE", label: "Three references", required: true },
      { docCode: "CV", label: "CV", required: true },
    ],
  },
  {
    slug: "jica-scholarship",
    type: "SCHOLARSHIP",
    title: "JICA Scholarship Program (Japan)",
    provider: "Japan International Cooperation Agency",
    countryCode: "JP",
    description:
      "Japanese government scholarship covering tuition, living costs, airfare and settlement allowance for students from partner countries, including Pakistan. " +
      note,
    categories: ["FULLY_FUNDED", "DEVELOPING_COUNTRIES"],
    applyUrl: "https://www.jica.go.jp/english/",
    sourceUrl: "https://www.jica.go.jp/english/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "FULL",
    tuitionCoveragePercent: null,
    coversLiving: true,
    coversTravel: true,
    criteria: [
      { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, label: "Open to Pakistani nationals" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, label: "Minimum academic result" },
      { code: "MAX_AGE", operator: "LTE", value: { lte: 30 }, label: "Maximum age" },
    ],
    documents: [
      { docCode: "PASSPORT", label: "Passport", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "RECOMMENDATION", label: "Recommendation letter", required: true },
    ],
  },
  {
    slug: "women-in-stem-scholarship",
    type: "SCHOLARSHIP",
    title: "Women in Engineering / STEM Scholarship",
    provider: "Women in STEM scholarship programmes",
    countryCode: null,
    description:
      "Awards supporting women entering engineering, computing and science fields. Eligibility is set by each provider. " + note,
    categories: ["WOMEN_IN_STEM"],
    applyUrl: null,
    sourceUrl: "https://www.unwomen.org/",
    isPaid: true,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: "PARTIAL",
    tuitionCoveragePercent: null,
    coversLiving: false,
    coversTravel: false,
    criteria: [
      { code: "GENDER", operator: "EQ", value: { eq: "FEMALE" }, label: "Women applicants" },
      { code: "FIELD", operator: "IN", value: { in: ["Engineering", "Computer Science", "Software Engineering", "Mathematics"] }, label: "STEM fields" },
    ],
    documents: [
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
      { docCode: "ID", label: "CNIC / passport", required: true },
    ],
  },
  {
    slug: "google-summer-of-code",
    type: "INTERNSHIP",
    title: "Google Summer of Code",
    provider: "Google (with open-source mentoring organisations)",
    countryCode: null,
    description:
      "Paid remote internship working on open-source projects with mentors from around the world. Open to students and recent graduates from any country, including Pakistan. " +
      note,
    categories: ["INTERNSHIP", "MERIT_BASED"],
    applyUrl: "https://summerofcode.withgoogle.com/",
    sourceUrl: "https://summerofcode.withgoogle.com/",
    isPaid: true,
    stipendMin: 0,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: null,
    tuitionCoveragePercent: null,
    coversLiving: false,
    coversTravel: false,
    criteria: [
      { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["UNDERGRADUATE", "MASTERS"] }, label: "Open to students and recent graduates" },
      { code: "MIN_CGPA", operator: "GTE", value: { gte: 2.5, scale: 4.0 }, label: "Minimum academic result" },
    ],
    documents: [
      { docCode: "CV", label: "CV / resume", required: true },
      { docCode: "TRANSCRIPT", label: "Transcript", required: true },
    ],
  },
  {
    slug: "khan-academy-free-courses",
    type: "COURSE",
    title: "Khan Academy — free courses",
    provider: "Khan Academy",
    countryCode: null,
    description: "Free academic and skills courses, available to any student. No financial eligibility criteria.",
    categories: ["FREE", "LEARNING"],
    applyUrl: "https://www.khanacademy.org/",
    sourceUrl: "https://www.khanacademy.org/",
    isPaid: false,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: false,
    tuitionCoverage: null,
    tuitionCoveragePercent: null,
    coversLiving: false,
    coversTravel: false,
    criteria: [],
    documents: [],
  },
  {
    slug: "icpc-regional-contest",
    type: "COMPETITION",
    title: "ICPC Regional Programming Contest",
    provider: "International Collegiate Programming Contest",
    countryCode: null,
    description:
      "Team programming competition for university students. Local and national rounds run through university contest societies. " + note,
    categories: ["COMPETITION"],
    applyUrl: null,
    sourceUrl: "https://icpc.global/",
    isPaid: false,
    stipendMin: null,
    isNeedBased: false,
    isMeritBased: true,
    tuitionCoverage: null,
    tuitionCoveragePercent: null,
    coversLiving: false,
    coversTravel: false,
    criteria: [
      { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["UNDERGRADUATE"] }, label: "University students" },
    ],
    documents: [{ docCode: "ID", label: "Student ID", required: true }],
  },
];

export type SeedStudent = {
  email: string;
  name: string;
  ageAtSignup: number;
  gender: "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
  hatScore: number | null;
  city: string;
  university: string;
  degree: string;
  degreeLevel: string;
  field: string;
  currentSemester: number;
  enrollmentStatus: string;
  graduationYear: number;
  documentsOnHand: string[];
  cgpa: number;
  incomeBandCode: string;
  earners: number;
  dependents: number;
  tuitionAnnual: number;
  accommodationStatus: string;
  accommodationAnnual: number | null;
  existingAidCoverage: string;
  assistanceRequired: boolean;
  personalisation: {
    primaryGoal: string;
    secondaryGoals: string[];
    stressTriggers: string[];
    supportPreference: string;
    availableHoursPerWeek: number;
    studyStyle: string;
    commuteMinutes: number;
    workCommitment: string;
    caresForOthers: boolean;
    tonePreference: string;
  };
  incomeSources: { label: string; monthly: number; stable: boolean }[];
  budgetExpenses: { code: string; label: string; monthly: number; essential: boolean }[];
  termsPerYear: number;
};

export const PK_DEMO_STUDENTS: SeedStudent[] = [
  {
    email: "ayesha@example.pk",
    name: "Ayesha Khan",
    ageAtSignup: 21,
    gender: "FEMALE",
    hatScore: null,
    city: "Lahore",
    university: "University of the Punjab",
    degree: "BS Software Engineering",
    degreeLevel: "UNDERGRADUATE",
    field: "Software Engineering",
    currentSemester: 6,
    enrollmentStatus: "FULL_TIME",
    graduationYear: 2027,
    documentsOnHand: ["TRANSCRIPT", "CNIC"],
    cgpa: 3.2,
    incomeBandCode: "PK_B1",
    earners: 1,
    dependents: 6,
    tuitionAnnual: 320_000,
    accommodationStatus: "RENTED",
    accommodationAnnual: 96_000,
    existingAidCoverage: "NONE",
    assistanceRequired: true,
    personalisation: {
      primaryGoal: "FINANCE",
      secondaryGoals: ["ACADEMIC"],
      stressTriggers: ["MONEY", "EXAMS", "FAMILY"],
      supportPreference: "PEER",
      availableHoursPerWeek: 26,
      studyStyle: "SPACED",
      commuteMinutes: 75,
      workCommitment: "PART_TIME",
      caresForOthers: true,
      tonePreference: "GENTLE",
    },
    incomeSources: [
      { label: "Family support", monthly: 12_000, stable: true },
      { label: "Weekend tutoring", monthly: 8_000, stable: false },
    ],
    budgetExpenses: [
      { code: "FOOD", label: "Food & groceries", monthly: 14_000, essential: true },
      { code: "TRANSPORT", label: "Transport & fuel", monthly: 5_000, essential: true },
      { code: "ACCOMMODATION", label: "Shared rent", monthly: 8_000, essential: true },
      { code: "PHONE_DATA", label: "Phone & internet", monthly: 2_500, essential: true },
      { code: "STUDY_MATERIALS", label: "Books & study materials", monthly: 2_000, essential: false },
      { code: "FAMILY_SUPPORT", label: "Support sent home", monthly: 4_000, essential: false },
      { code: "SOCIAL", label: "Social & outings", monthly: 1_500, essential: false },
      { code: "HEALTH", label: "Health & pharmacy", monthly: 1_000, essential: true },
    ],
    termsPerYear: 2,
  },
  {
    email: "bilal@example.pk",
    name: "Bilal Ahmed",
    ageAtSignup: 23,
    gender: "MALE",
    city: "Karachi",
    university: "NED University of Engineering & Technology",
    degree: "BS Computer Science",
    degreeLevel: "UNDERGRADUATE",
    field: "Computer Science",
    currentSemester: 8,
    enrollmentStatus: "FULL_TIME",
    graduationYear: 2026,
    documentsOnHand: ["TRANSCRIPT", "CNIC", "CV", "PASSPORT"],
    cgpa: 3.85,
    hatScore: 72,
    incomeBandCode: "PK_B4",
    earners: 2,
    dependents: 2,
    tuitionAnnual: 180_000,
    accommodationStatus: "FAMILY_HOME",
    accommodationAnnual: null,
    existingAidCoverage: "NONE",
    assistanceRequired: false,
    personalisation: {
      primaryGoal: "CAREER",
      secondaryGoals: ["ACADEMIC"],
      stressTriggers: ["EXAMS", "CAREER"],
      supportPreference: "SELF_GUIDED",
      availableHoursPerWeek: 34,
      studyStyle: "INTENSIVE",
      commuteMinutes: 35,
      workCommitment: "PART_TIME",
      caresForOthers: false,
      tonePreference: "DETAILED",
    },
    incomeSources: [
      { label: "Family support", monthly: 40_000, stable: true },
      { label: "Lab assistantship", monthly: 15_000, stable: true },
    ],
    budgetExpenses: [
      { code: "FOOD", label: "Food & canteen", monthly: 12_000, essential: true },
      { code: "TRANSPORT", label: "Transport & fuel", monthly: 6_000, essential: true },
      { code: "ACCOMMODATION", label: "Campus hostel", monthly: 5_000, essential: true },
      { code: "PHONE_DATA", label: "Phone & internet", monthly: 2_500, essential: true },
      { code: "STUDY_MATERIALS", label: "Books & software", monthly: 2_500, essential: false },
      { code: "SOCIAL", label: "Social & outings", monthly: 3_000, essential: false },
      { code: "HEALTH", label: "Health & pharmacy", monthly: 1_500, essential: true },
    ],
    termsPerYear: 2,
  },
  {
    email: "sana@example.pk",
    name: "Sana Malik",
    ageAtSignup: 26,
    gender: "FEMALE",
    hatScore: 65,
    city: "Islamabad",
    university: "Quaid-i-Azam University",
    degree: "MS Economics",
    degreeLevel: "MASTERS",
    field: "Economics",
    currentSemester: 2,
    enrollmentStatus: "FULL_TIME",
    graduationYear: 2027,
    documentsOnHand: ["TRANSCRIPT", "CNIC", "DEGREE"],
    cgpa: 3.45,
    incomeBandCode: "PK_B3",
    earners: 1,
    dependents: 3,
    tuitionAnnual: 240_000,
    accommodationStatus: "CAMPUS",
    accommodationAnnual: 60_000,
    existingAidCoverage: "PARTIAL",
    assistanceRequired: true,
    personalisation: {
      primaryGoal: "FINANCE",
      secondaryGoals: ["WELLBEING", "CAREER"],
      stressTriggers: ["MONEY", "FAMILY"],
      supportPreference: "PROFESSIONAL",
      availableHoursPerWeek: 20,
      studyStyle: "STEADY",
      commuteMinutes: 20,
      workCommitment: "NONE",
      caresForOthers: true,
      tonePreference: "DIRECT",
    },
    incomeSources: [
      { label: "Family support", monthly: 20_000, stable: true },
      { label: "Freelance writing", monthly: 7_000, stable: false },
    ],
    budgetExpenses: [
      { code: "FOOD", label: "Food & groceries", monthly: 13_000, essential: true },
      { code: "TRANSPORT", label: "Transport", monthly: 4_000, essential: true },
      { code: "ACCOMMODATION", label: "Campus hostel", monthly: 5_000, essential: true },
      { code: "PHONE_DATA", label: "Phone & internet", monthly: 2_000, essential: true },
      { code: "STUDY_MATERIALS", label: "Books & study materials", monthly: 2_500, essential: false },
      { code: "FAMILY_SUPPORT", label: "Support sent home", monthly: 3_000, essential: false },
      { code: "HEALTH", label: "Health & pharmacy", monthly: 1_500, essential: true },
      { code: "OTHER", label: "Course retake fee buffer", monthly: 1_000, essential: false },
    ],
    termsPerYear: 2,
  },
];

/** Keeps the demo honest: no real student data, ever. */
export const PK_SUPPORT_SERVICES = [
  {
    type: "CRISIS_HOTLINE",
    name: "Punjab Rescue 1123",
    org: "Punjab Rescue & Emergency Services",
    countryCode: "PK",
    phone: "1123",
    website: "https://1123.punjab.gov.pk/",
    openingHours: "24/7",
    languages: ["Urdu", "English", "Punjabi"],
    isEmergency: true,
    note: "Punjab province — confirm national coverage before launch",
  },
  {
    type: "CRISIS_HOTLINE",
    name: "Police / Rescue emergency",
    org: "Police and Rescue services",
    countryCode: "PK",
    phone: "15",
    website: null,
    openingHours: "24/7",
    languages: ["Urdu", "English"],
    isEmergency: true,
    note: null,
  },
  {
    type: "FINANCIAL_AID",
    name: "University Financial Aid Office",
    org: "Student financial aid /bursar's office",
    countryCode: "PK",
    phone: null,
    website: null,
    openingHours: "University working hours",
    languages: ["English", "Urdu"],
    isEmergency: false,
    note: "Generic entry — replace with your university's real office",
  },
  {
    type: "ACADEMIC_ADVISOR",
    name: "Academic Advisor / Student Affairs",
    org: "Department office",
    countryCode: "PK",
    phone: null,
    website: null,
    openingHours: "University working hours",
    languages: ["English", "Urdu"],
    isEmergency: false,
    note: "Generic entry — replace with your university's real office",
  },
  {
    type: "COUNSELOR",
    name: "University Counsellor",
    org: "Student counselling centre",
    countryCode: "PK",
    phone: null,
    website: null,
    openingHours: "University working hours",
    languages: ["English", "Urdu"],
    isEmergency: false,
    note: "Generic entry — replace with your university's real office",
  },
  {
    type: "CAREER_CENTER",
    name: "Career Development Centre",
    org: "Placement and careers office",
    countryCode: "PK",
    phone: null,
    website: null,
    openingHours: "University working hours",
    languages: ["English", "Urdu"],
    isEmergency: false,
    note: "Generic entry — replace with your university's real office",
  },
];
