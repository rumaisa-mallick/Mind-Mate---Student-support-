/**
 * Concern classifier.
 *
 * Contract (docs/PLAN.md §4.2):
 *  1. Structured factor tags from the check-in form are ground-truth labels —
 *     no NLP required, and they always outrank free-text guesses.
 *  2. Free text is scored with a weighted lexicon (phrase-level entries beat
 *     single tokens), with negation windows and intensifiers.
 *  3. Output labels describe CIRCUMSTANCES, never clinical conditions.
 *     "depression", "anxiety disorder", "ADHD" etc. are banned — see
 *     BANNED_CLINICAL_TERMS, which the safety test asserts against.
 *  4. Below the confidence threshold we say "other" and show neutral
 *     resources rather than guessing.
 *
 * An optional LLM pass may refine these numbers (HYBRID mode); it can never
 * introduce a category outside CONCERN_CATEGORIES, and the product never
 * blocks on it.
 *
 * Pure module. No I/O, no framework imports.
 */

export const CONCERN_CATEGORIES = [
  "academic",
  "financial",
  "career",
  "family",
  "relationships",
  "loneliness",
  "health",
  "sleep",
  "other",
] as const;

export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number];

export const CHECKIN_FACTORS = [
  "EXAMS",
  "ASSIGNMENT",
  "MONEY",
  "CAREER",
  "FAMILY",
  "RELATIONSHIPS",
  "LONELINESS",
  "SLEEP",
  "HEALTH",
  "OTHER",
] as const;

export type CheckinFactor = (typeof CHECKIN_FACTORS)[number];

export const FACTOR_TO_CATEGORY: Record<CheckinFactor, ConcernCategory> = {
  EXAMS: "academic",
  ASSIGNMENT: "academic",
  MONEY: "financial",
  CAREER: "career",
  FAMILY: "family",
  RELATIONSHIPS: "relationships",
  LONELINESS: "loneliness",
  SLEEP: "sleep",
  HEALTH: "health",
  OTHER: "other",
};

export const CATEGORY_LABELS: Record<ConcernCategory, string> = {
  academic: "Academic",
  financial: "Financial",
  career: "Career",
  family: "Family",
  relationships: "Relationships",
  loneliness: "Loneliness",
  health: "Health",
  sleep: "Sleep",
  other: "General",
};

/** Clinical vocabulary this system must never produce. Enforced by tests. */
export const BANNED_CLINICAL_TERMS = [
  "depression",
  "depressed",
  "anxiety disorder",
  "panic disorder",
  "bipolar",
  "schizophrenia",
  "adhd",
  "ptsd",
  "clinical",
  "diagnosis",
  "diagnosed",
  "bipolar disorder",
  "you are mentally ill",
] as const;

interface LexiconEntry {
  phrase: string;
  weight: number;
  category: ConcernCategory;
}

/**
 * Phrase-level entries are weighted above single tokens because multi-word
 * matches are far less likely to be incidental ("fees" vs "cannot pay fees").
 */
export const CONCERN_LEXICON: LexiconEntry[] = [
  // financial
  { phrase: "tuition fee", weight: 3, category: "financial" },
  { phrase: "tuition fees", weight: 3, category: "financial" },
  { phrase: "semester fee", weight: 3, category: "financial" },
  { phrase: "cannot pay", weight: 3, category: "financial" },
  { phrase: "can't pay", weight: 3, category: "financial" },
  { phrase: "not able to pay", weight: 3, category: "financial" },
  { phrase: "unable to pay", weight: 3, category: "financial" },
  { phrase: "run out of money", weight: 3, category: "financial" },
  { phrase: "out of money", weight: 2.5, category: "financial" },
  { phrase: "no money", weight: 3, category: "financial" },
  { phrase: "money", weight: 2.5, category: "financial" },
  { phrase: "short of money", weight: 3, category: "financial" },
  { phrase: "afford", weight: 2.5, category: "financial" },
  { phrase: "expensive", weight: 1.5, category: "financial" },
  { phrase: "scholarship", weight: 2, category: "financial" },
  { phrase: "financial aid", weight: 2.5, category: "financial" },
  { phrase: "financial problem", weight: 3, category: "financial" },
  { phrase: "money problem", weight: 3, category: "financial" },
  { phrase: "budget", weight: 1.5, category: "financial" },
  { phrase: "loan", weight: 1.5, category: "financial" },
  { phrase: "emi", weight: 2, category: "financial" },
  { phrase: "rent", weight: 1.5, category: "financial" },
  { phrase: "paisa", weight: 2, category: "financial" },
  { phrase: "fees", weight: 1.5, category: "financial" },
  { phrase: "expensive fees", weight: 2.5, category: "financial" },

  // academic
  { phrase: "final exams", weight: 2.5, category: "academic" },
  { phrase: "mid exams", weight: 2.5, category: "academic" },
  { phrase: "exam", weight: 1.5, category: "academic" },
  { phrase: "exams", weight: 1.5, category: "academic" },
  { phrase: "assignment", weight: 2, category: "academic" },
  { phrase: "assignments", weight: 2, category: "academic" },
  { phrase: "deadline", weight: 1.5, category: "academic" },
  { phrase: "cgpa", weight: 2, category: "academic" },
  { phrase: "gpa", weight: 1.5, category: "academic" },
  { phrase: "grades", weight: 2, category: "academic" },
  { phrase: "marks", weight: 1.5, category: "academic" },
  { phrase: "fail", weight: 2, category: "academic" },
  { phrase: "failing", weight: 2, category: "academic" },
  { phrase: "backlog", weight: 2, category: "academic" },
  { phrase: "thesis", weight: 2, category: "academic" },
  { phrase: "project submission", weight: 2, category: "academic" },
  { phrase: "university admission test", weight: 2, category: "academic" },
  { phrase: "sat", weight: 1.5, category: "academic" },
  { phrase: "study plan", weight: 1.5, category: "academic" },
  { phrase: "procrastinat", weight: 2, category: "academic" },
  { phrase: "late night study", weight: 1.5, category: "academic" },

  // career
  { phrase: "placement", weight: 2.5, category: "career" },
  { phrase: "internship", weight: 2.5, category: "career" },
  { phrase: "career", weight: 2, category: "career" },
  { phrase: "job", weight: 1.5, category: "career" },
  { phrase: "unemployed", weight: 2.5, category: "career" },
  { phrase: "no job", weight: 2.5, category: "career" },
  { phrase: "cv", weight: 1.5, category: "career" },
  { phrase: "resume", weight: 1.5, category: "career" },
  { phrase: "interview", weight: 2, category: "career" },
  { phrase: "future", weight: 1, category: "career" },
  { phrase: "what will i do after", weight: 2.5, category: "career" },
  { phrase: "undecided", weight: 1.5, category: "career" },

  // family
  { phrase: "family pressure", weight: 3, category: "family" },
  { phrase: "family expectations", weight: 3, category: "family" },
  { phrase: "my family", weight: 1.5, category: "family" },
  { phrase: "my parents", weight: 2, category: "family" },
  { phrase: "parents", weight: 1.5, category: "family" },
  { phrase: "amma", weight: 1.5, category: "family" },
  { phrase: "abbu", weight: 1.5, category: "family" },
  { phrase: "fight with parents", weight: 3, category: "family" },
  { phrase: "argue with", weight: 2, category: "family" },
  { phrase: "expectations", weight: 1.5, category: "family" },
  { phrase: "marriage", weight: 1.5, category: "family" },
  { phrase: "siblings", weight: 1, category: "family" },

  // relationships
  { phrase: "break up", weight: 3, category: "relationships" },
  { phrase: "breakup", weight: 3, category: "relationships" },
  { phrase: "relationship problem", weight: 3, category: "relationships" },
  { phrase: "heartbroken", weight: 3, category: "relationships" },
  { phrase: "cheated", weight: 2.5, category: "relationships" },
  { phrase: "rejected", weight: 1.5, category: "relationships" },
  { phrase: "boyfriend", weight: 1.5, category: "relationships" },
  { phrase: "girlfriend", weight: 1.5, category: "relationships" },
  { phrase: "love", weight: 1, category: "relationships" },

  // loneliness
  { phrase: "all alone", weight: 3, category: "loneliness" },
  { phrase: "no friends", weight: 3, category: "loneliness" },
  { phrase: "lonely", weight: 3, category: "loneliness" },
  { phrase: "isolated", weight: 2.5, category: "loneliness" },
  { phrase: "homesick", weight: 3, category: "loneliness" },
  { phrase: "left out", weight: 2, category: "loneliness" },
  { phrase: "not belong", weight: 2.5, category: "loneliness" },
  { phrase: "nobody", weight: 2, category: "loneliness" },
  { phrase: "miss my family", weight: 2, category: "loneliness" },

  // sleep
  { phrase: "can't sleep", weight: 3, category: "sleep" },
  { phrase: "cannot sleep", weight: 3, category: "sleep" },
  { phrase: "not sleeping", weight: 3, category: "sleep" },
  { phrase: "insomnia", weight: 3, category: "sleep" },
  { phrase: "awake all night", weight: 3, category: "sleep" },
  { phrase: "up all night", weight: 2.5, category: "sleep" },
  { phrase: "tired all the time", weight: 2, category: "sleep" },
  { phrase: "no sleep", weight: 3, category: "sleep" },
  { phrase: "exhausted", weight: 1.5, category: "sleep" },

  // health
  { phrase: "sick", weight: 1.5, category: "health" },
  { phrase: "illness", weight: 2, category: "health" },
  { phrase: "headache", weight: 1.5, category: "health" },
  { phrase: "not eating", weight: 2, category: "health" },
  { phrase: "lost weight", weight: 1.5, category: "health" },
  { phrase: "hospital", weight: 2, category: "health" },
  { phrase: "fever", weight: 1.5, category: "health" },
];

/**
 * Crisis language. Matching any of these must render the safety surface
 * immediately — before any other output, and never gated behind an LLM call
 * (docs/PLAN.md §6.3, risk R3).
 */
export const CRISIS_PHRASES = [
  "suicide",
  "suicidal",
  "kill myself",
  "killing myself",
  "end my life",
  "end my life",
  "want to die",
  "want to kill",
  "self harm",
  "harm myself",
  "hurt myself",
  "cut myself",
  "no reason to live",
  "better off dead",
  "cant go on",
  "cannot go on",
  "give up on life",
] as const;

const NEGATIONS = new Set([
  "not",
  "no",
  "never",
  "dont",
  "do not",
  "doesnt",
  "didnt",
  "isnt",
  "wasnt",
  "arent",
  "werent",
  "wont",
  "cannot",
  "cant",
  "aint",
  "without",
  "except",
]);

const INTENSIFIERS = new Set([
  "very",
  "extremely",
  "really",
  "so",
  "too",
  "always",
  "constantly",
  "totally",
  "completely",
  "utterly",
  "incredibly",
  "super",
  "badly",
  "heavily",
]);

const DIMINISHERS = new Set(["slightly", "little", "bit", "somewhat", "mildly", "occasionally"]);

/** Under this total score we refuse to name a dominant concern. */
export const MIN_DOMINANT_SCORE = 1;

/** Structured tags are treated as strong evidence. */
const TAG_WEIGHT = 3;

/** Multiplier applied to a tag-derived score so tags always beat text guesses. */
const TAG_DOMINANCE_BOOST = 1.25;

export interface ClassifyInput {
  note?: string | null;
  tags?: CheckinFactor[];
}

export interface ConcernScore {
  category: ConcernCategory;
  score: number;
}

export interface Classification {
  engineVersion: string;
  engineMode: "RULES";
  scores: Record<ConcernCategory, number>;
  dominantConcern: ConcernCategory;
  confidence: number;
  /** Matched phrases — needed for explainability and for debugging a bad result. */
  evidence: string[];
  /** Phrases that matched but were suppressed by a negation window. */
  negated: string[];
  tagSourced: boolean;
  crisisDetected: boolean;
}

export const CLASSIFIER_VERSION = "classifier-v1";

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);

/** Index of the first token window matching `phrase`, or -1. */
function findPhrase(tokens: string[], phrase: string): number {
  const needle = phrase.split(" ");
  if (needle.length === 1) return tokens.indexOf(needle[0]);
  for (let i = 0; i + needle.length <= tokens.length; i += 1) {
    let matched = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (tokens[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

function modifierBefore(tokens: string[], phraseStart: number, windowSize: number): number {
  const start = Math.max(0, phraseStart - windowSize);
  const context = tokens.slice(start, phraseStart);
  if (context.some((token) => NEGATIONS.has(token))) return 0;
  if (context.some((token) => DIMINISHERS.has(token))) return 0.5;
  if (context.some((token) => INTENSIFIERS.has(token))) return 1.5;
  return 1;
}

const emptyScores = (): Record<ConcernCategory, number> =>
  CONCERN_CATEGORIES.reduce(
    (accumulator, category) => {
      accumulator[category] = 0;
      return accumulator;
    },
    {} as Record<ConcernCategory, number>,
  );

export function detectCrisisLanguage(note?: string | null): boolean {
  if (!note) return false;
  const tokens = tokenize(note);
  return CRISIS_PHRASES.some((phrase) => findPhrase(tokens, phrase) !== -1);
}

export function classifyConcerns(input: ClassifyInput): Classification {
  const scores = emptyScores();
  const evidence: string[] = [];
  const negated: string[] = [];

  const tags = input.tags ?? [];
  const tagSourced = tags.length > 0;

  // 1. Structured tags are labels, not hints.
  for (const tag of tags) {
    const category = FACTOR_TO_CATEGORY[tag];
    if (category) {
      scores[category] += TAG_WEIGHT * TAG_DOMINANCE_BOOST;
      evidence.push(`tag:${tag}`);
    }
  }

  // 2. Free text via weighted lexicon.
  const note = input.note?.trim();
  if (note) {
    const tokens = tokenize(note);
    for (const entry of CONCERN_LEXICON) {
      const at = findPhrase(tokens, entry.phrase);
      if (at === -1) continue;
      const phraseTokens = entry.phrase.split(" ").length;
      const multiplier = modifierBefore(tokens, at, phraseTokens === 1 ? 3 : 4);
      if (multiplier === 0) {
        negated.push(entry.phrase);
        continue;
      }
      scores[entry.category] += entry.weight * multiplier;
      evidence.push(entry.phrase);
    }
  }

  const total = CONCERN_CATEGORIES.reduce((sum, category) => sum + scores[category], 0);

  let dominantConcern: ConcernCategory = "other";
  let confidence = 0;
  if (total > 0) {
    let best: ConcernCategory = "other";
    for (const category of CONCERN_CATEGORIES) {
      if (scores[category] > scores[best]) best = category;
    }
    if (scores[best] >= MIN_DOMINANT_SCORE) {
      dominantConcern = best;
      confidence = Math.round((scores[best] / total) * 100) / 100;
    }
  }

  return {
    engineVersion: CLASSIFIER_VERSION,
    engineMode: "RULES",
    scores,
    dominantConcern,
    confidence,
    evidence,
    negated,
    tagSourced,
    crisisDetected: detectCrisisLanguage(note),
  };
}

export interface ConcernAction {
  concern: ConcernCategory;
  label: string;
  /** Label of the remedy — financial concerns route to funding, not breathing exercises. */
  remedy: string;
  target: string;
}

/**
 * Concern → remedy mapping. This is the product's whole thesis: a financial
 * concern routes to scholarship matching, not to a meditation track
 * (docs/PLAN.md §8 — "it shouldn't just recommend breathing exercises").
 */
export const CONCERN_ACTIONS: Record<ConcernCategory, { remedy: string; target: string }[]> = {
  financial: [
    { remedy: "See scholarships you may qualify for", target: "/opportunities" },
    { remedy: "Understand your financial need score", target: "/financial" },
    { remedy: "Contact your university financial aid office", target: "/support?type=FINANCIAL_AID" },
  ],
  academic: [
    { remedy: "Build a study plan", target: "/resources?category=STUDY" },
    { remedy: "Talk to your academic advisor", target: "/support?type=ACADEMIC_ADVISOR" },
  ],
  career: [
    { remedy: "Explore internships and fellowships", target: "/opportunities?type=INTERNSHIP" },
    { remedy: "Visit the career centre", target: "/support?type=CAREER_CENTER" },
  ],
  family: [
    { remedy: "Family and caregiver support resources", target: "/resources?category=FAMILY" },
    { remedy: "Talk to a counsellor", target: "/support?type=COUNSELOR" },
  ],
  relationships: [
    { remedy: "Relationship wellbeing resources", target: "/resources?category=RELATIONSHIPS" },
    { remedy: "Talk to a counsellor", target: "/support?type=COUNSELOR" },
  ],
  loneliness: [
    { remedy: "Find peer support", target: "/community" },
    { remedy: "Join a student society", target: "/resources?category=COMMUNITY" },
  ],
  sleep: [
    { remedy: "Sleep and study-rest resources", target: "/resources?category=SLEEP" },
    { remedy: "Speak with the university health service", target: "/support?type=COUNSELOR" },
  ],
  health: [
    { remedy: "University health service", target: "/support?type=COUNSELOR" },
    { remedy: "Wellbeing resources", target: "/resources?category=HEALTH" },
  ],
  other: [
    { remedy: "Browse wellbeing resources", target: "/resources" },
    { remedy: "Talk to a counsellor", target: "/support?type=COUNSELOR" },
  ],
};

export function actionsFor(concern: ConcernCategory, limit = 3): ConcernAction[] {
  return CONCERN_ACTIONS[concern].slice(0, limit).map((action) => ({
    concern,
    label: CATEGORY_LABELS[concern],
    ...action,
  }));
}

/** Top-N concerns above the threshold, for the dashboard "top concerns" row. */
export function topConcerns(
  classification: Classification,
  limit = 3,
): { category: ConcernCategory; score: number }[] {
  return CONCERN_CATEGORIES.map((category) => ({ category, score: classification.scores[category] }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
