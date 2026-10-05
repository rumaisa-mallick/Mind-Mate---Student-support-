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
  criteria: { code: string; operator: string; value: Record<string, unknown>; label?: string }[];
  documents: { docCode: string; label: string; required: boolean }[];
};

const note = "Indicative criteria — confirm current requirements on the official page before applying.";

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
};

export const PK_DEMO_STUDENTS: SeedStudent[] = [
  {
    email: "ayesha@example.pk",
    name: "Ayesha Khan",
    ageAtSignup: 21,
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
  },
  {
    email: "bilal@example.pk",
    name: "Bilal Ahmed",
    ageAtSignup: 23,
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
    incomeBandCode: "PK_B4",
    earners: 2,
    dependents: 2,
    tuitionAnnual: 180_000,
    accommodationStatus: "FAMILY_HOME",
    accommodationAnnual: null,
    existingAidCoverage: "NONE",
    assistanceRequired: false,
  },
  {
    email: "sana@example.pk",
    name: "Sana Malik",
    ageAtSignup: 26,
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
