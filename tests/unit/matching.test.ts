import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  matchOpportunities,
  matchOpportunity,
  daysToDeadline,
  freshnessFactor,
  weightsFor,
  evaluateCriterion,
  type OpportunityForMatching,
  type StudentMatchInput,
} from "../../src/domain/matching/engine.ts";

const TODAY = "2026-10-05";

const student: StudentMatchInput = {
  age: 21,
  countryCode: "PK",
  nationality: "PK",
  cgpa: 3.2,
  cgpaScale: 4.0,
  degreeLevel: "UNDERGRADUATE",
  field: "Software Engineering",
  gender: "FEMALE",
  enrollmentStatus: "FULL_TIME",
  financialNeedScore: 78,
  annualTuition: 300_000,
  documentsOnHand: ["TRANSCRIPT", "CNIC"],
  holdsPriorScholarship: false,
};

const needBasedScholarship: OpportunityForMatching = {
  id: "hec-need-based",
  title: "HEC Need-Based Scholarship",
  type: "SCHOLARSHIP",
  isNeedBased: true,
  tuitionCoverage: "PERCENT",
  tuitionCoveragePercent: 50,
  stipendAmount: 5_000,
  requiredDocuments: ["TRANSCRIPT", "CNIC", "INCOME_CERTIFICATE"],
  deadline: "2026-11-15",
  verificationStatus: "VERIFIED",
  lastVerifiedAt: "2026-10-01",
  criteria: [
    { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, required: true },
    { code: "DEGREE_LEVEL", operator: "IN", value: { in: ["UNDERGRADUATE"] }, required: true },
    { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.0, scale: 4.0 }, required: true },
    { code: "INCOME_NEED", operator: "GTE", value: { gte: 55, scale: 100 }, required: true },
    { code: "MAX_AGE", operator: "LTE", value: { lte: 25 }, required: true },
  ],
};

const meritScholarship: OpportunityForMatching = {
  id: "merit-full",
  title: "Merit Full Tuition Scholarship",
  type: "SCHOLARSHIP",
  isMeritBased: true,
  tuitionCoverage: "FULL",
  coversLiving: true,
  requiredDocuments: ["TRANSCRIPT"],
  deadline: "2027-02-01",
  verificationStatus: "VERIFIED",
  lastVerifiedAt: "2026-09-20",
  criteria: [
    { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, required: true },
    { code: "MIN_CGPA", operator: "GTE", value: { gte: 3.5, scale: 4.0 }, required: true },
  ],
};

const womenInStem: OpportunityForMatching = {
  id: "women-stem",
  title: "Women in Engineering Award",
  type: "SCHOLARSHIP",
  isMeritBased: true,
  tuitionCoverage: "PARTIAL",
  verificationStatus: "UNVERIFIED",
  deadline: null,
  criteria: [
    { code: "GENDER", operator: "EQ", value: { eq: "FEMALE" }, required: true },
    { code: "FIELD", operator: "IN", value: { in: ["Engineering"] }, required: true },
  ],
};

describe("stage A — hard filters", () => {
  test("eligible student passes and receives reasons + breakdown", () => {
    const result = matchOpportunity(needBasedScholarship, student, TODAY);
    assert.equal(result.eligible, true);
    assert.ok(result.score !== null && result.score > 0);
    assert.ok(result.reasons.includes("NEED_CRITERION_MET"));
    assert.ok(result.reasons.includes("CGPA_ABOVE_MIN"));
    assert.ok(result.breakdown.length > 0);
  });

  test("a failed hard filter disqualifies and explains why", () => {
    const weakStudent = { ...student, cgpa: 2.4 };
    const result = matchOpportunity(needBasedScholarship, weakStudent, TODAY);
    assert.equal(result.eligible, false);
    assert.equal(result.score, null);
    const cgpa = result.disqualifiers.find((d) => d.code === "MIN_CGPA");
    assert.ok(cgpa, "expected a MIN_CGPA disqualifier");
    assert.match(cgpa.humanText, /2\.4/);
    assert.match(cgpa.humanText, /3/);
  });

  test("a disqualifier is never a dead end — human text is always present", () => {
    const result = matchOpportunity(needBasedScholarship, { ...student, age: 40 }, TODAY);
    assert.equal(result.eligible, false);
    for (const disqualifier of result.disqualifiers) {
      assert.ok(disqualifier.humanText.length > 10, "disqualifier needs real explanation");
      assert.ok(disqualifier.label.length > 0);
    }
  });

  test("country restriction is enforced", () => {
    const criterion = { code: "COUNTRY", operator: "IN", value: { in: ["PK"] }, required: true } as const;
    assert.equal(evaluateCriterion(criterion, student).passed, true);
    assert.equal(evaluateCriterion(criterion, { ...student, countryCode: "BD" }).passed, false);
  });

  test("closed deadline disqualifies", () => {
    const closed = { ...needBasedScholarship, deadline: "2026-09-01" };
    const result = matchOpportunity(closed, student, TODAY);
    assert.equal(result.eligible, false);
    assert.ok(result.disqualifiers.some((d) => d.code === "DEADLINE_CLOSED"));
  });

  test("missing student input is assumed-eligible and flagged, not guessed as a failure", () => {
    const noCgpa = { ...student, cgpa: null };
    const result = matchOpportunity(needBasedScholarship, noCgpa, TODAY);
    assert.equal(result.eligible, true, "must not hard-fail a student for missing data");
    assert.ok(result.unverifiedCriteria.includes("MIN_CGPA"));
    assert.ok(result.confidenceFactor < 1, "confidence must be reduced");
  });

  test("CGPA compares on a normalised scale", () => {
    const percentageScaleStudent = { ...student, cgpa: 82, cgpaScale: 100 };
    const result = matchOpportunity(needBasedScholarship, percentageScaleStudent, TODAY);
    assert.equal(result.eligible, true, "82% should satisfy a 3.0/4.0 requirement");
  });
});

describe("stage B — scoring", () => {
  test("score stays within 0..100 and breakdown points sum to it", () => {
    const summary = matchOpportunities([needBasedScholarship, meritScholarship], student, TODAY);
    for (const result of summary.eligible) {
      assert.ok(result.score! >= 0 && result.score! <= 100, `score ${result.score}`);
      const summed = result.breakdown.reduce((total, b) => total + b.points, 0);
      assert.ok(Math.abs(summed - result.score!) <= 3, `${summed} vs ${result.score}`);
    }
  });

  test("higher need ranks a need-based scholarship higher", () => {
    const highNeed = { ...student, financialNeedScore: 95 };
    const lowNeed = { ...student, financialNeedScore: 20 };
    const high = matchOpportunity(needBasedScholarship, highNeed, TODAY).score!;
    const low = matchOpportunity(needBasedScholarship, lowNeed, TODAY).score!;
    assert.ok(high > low, `expected ${high} > ${low}`);
  });

  test("need-based weighting is dominated by need, merit-based by academics", () => {
    const needWeights = weightsFor(needBasedScholarship);
    const meritWeights = weightsFor(meritScholarship);
    assert.ok(needWeights.NEED_FIT > needWeights.ACADEMIC_FIT);
    assert.ok(meritWeights.ACADEMIC_FIT > meritWeights.NEED_FIT);
  });

  test("full tuition coverage scores higher on the coverage component", () => {
    // Merit scholarship needs 3.5 CGPA, so compare using a student who clears both.
    const strongStudent = { ...student, cgpa: 3.6 };
    const fullCoverage = matchOpportunity(meritScholarship, strongStudent, TODAY)
      .breakdown.find((b) => b.code === "COVERAGE_VALUE")!;
    const partialCoverage = matchOpportunity(needBasedScholarship, strongStudent, TODAY)
      .breakdown.find((b) => b.code === "COVERAGE_VALUE")!;
    assert.ok(fullCoverage.value > partialCoverage.value);
  });

  test("unverified data is demoted by the freshness factor", () => {
    const verified = freshnessFactor("VERIFIED", "2026-10-01", TODAY);
    const unverified = freshnessFactor("UNVERIFIED", null, TODAY);
    const stale = freshnessFactor("VERIFIED", "2025-01-01", TODAY);
    assert.ok(verified > unverified, `${verified} vs ${unverified}`);
    assert.ok(unverified > stale, `${unverified} vs ${stale}`);
    assert.ok(matchOpportunity(womenInStem, student, TODAY).reasons.includes("UNVERIFIED_SOURCE"));
  });

  test("near-miss is detected for a small closable gap", () => {
    const almost = { ...student, cgpa: 2.95 };
    const result = matchOpportunity(needBasedScholarship, almost, TODAY);
    assert.equal(result.eligible, false);
    assert.equal(result.nearMiss, true, "0.05 CGPA short should be a near-miss, not a dead end");
  });

  test("a large gap is not a near-miss", () => {
    const far = { ...student, cgpa: 1.2 };
    assert.equal(matchOpportunity(needBasedScholarship, far, TODAY).nearMiss, false);
  });

  test("gender-restricted award matches this student", () => {
    const result = matchOpportunity(womenInStem, student, TODAY);
    assert.equal(result.eligible, true);
  });

  test("summary is sorted by score descending", () => {
    const summary = matchOpportunities(
      [womenInStem, needBasedScholarship, meritScholarship],
      student,
      TODAY,
    );
    const scores = summary.eligible.map((r) => r.score ?? 0);
    const sorted = [...scores].sort((a, b) => b - a);
    assert.deepEqual(scores, sorted);
    assert.equal(summary.totalCandidates, 3);
    assert.ok(summary.eligibleCount >= 1);
  });

  test("daysToDeadline handles null, future and past", () => {
    assert.equal(daysToDeadline(null, TODAY), null);
    assert.equal(daysToDeadline("2026-10-05", TODAY), 0);
    assert.ok(daysToDeadline("2026-11-04", TODAY)! > 29);
    assert.ok(daysToDeadline("2026-10-01", TODAY)! < 0);
  });
});
