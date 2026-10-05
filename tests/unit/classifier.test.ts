import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  classifyConcerns,
  detectCrisisLanguage,
  topConcerns,
  actionsFor,
  CONCERN_CATEGORIES,
  BANNED_CLINICAL_TERMS,
  type Classification,
} from "../../src/domain/wellbeing/classifier.ts";

describe("concern classifier", () => {
  test("structured tags act as labels without any NLP", () => {
    const result = classifyConcerns({ tags: ["MONEY"] });
    assert.equal(result.dominantConcern, "financial");
    assert.equal(result.tagSourced, true);
    assert.ok(result.scores.financial > 0);
  });

  test("tags outrank weaker free-text evidence", () => {
    const tagged = classifyConcerns({ note: "assignment deadline", tags: ["MONEY"] });
    assert.equal(tagged.dominantConcern, "financial");
  });

  test("a mixed note surfaces both academic and financial concerns", () => {
    const result = classifyConcerns({
      note: "I have my final exams next month and my parents cannot pay my semester fees.",
    });
    assert.ok(result.scores.academic > 0, "academic should be detected");
    assert.ok(result.scores.financial > 0, "financial should be detected");
    assert.ok(result.scores.family > 0, "family should be detected");
  });

  test("negation suppresses a match", () => {
    const positive = classifyConcerns({ note: "I am so stressed about money" });
    const negated = classifyConcerns({ note: "I am not stressed about money" });
    assert.ok(positive.scores.financial > 0);
    assert.equal(negated.scores.financial, 0);
    assert.ok(negated.negated.length > 0, "negated evidence should be recorded");
  });

  test("intensifiers increase the score", () => {
    const plain = classifyConcerns({ note: "i am stressed about fees" });
    const intense = classifyConcerns({ note: "i am extremely stressed about fees" });
    assert.ok(intense.scores.financial > plain.scores.financial);
  });

  test("below the threshold we return 'other' rather than guessing", () => {
    const vague = classifyConcerns({ note: "hmm" });
    assert.equal(vague.dominantConcern, "other");
    assert.equal(vague.confidence, 0);
  });

  test("confidence is a 0..1 proportion of total evidence", () => {
    const result = classifyConcerns({ note: "cannot pay tuition fees" });
    assert.ok(result.confidence > 0 && result.confidence <= 1);
    assert.equal(result.confidence, 1);
  });

  test("every score key belongs to the fixed category vocabulary", () => {
    const result = classifyConcerns({ note: "cant sleep, feeling alone, worried about placement" });
    for (const key of Object.keys(result.scores)) {
      assert.ok(
        (CONCERN_CATEGORIES as readonly string[]).includes(key),
        `unexpected category: ${key}`,
      );
    }
  });

  test("crisis language is detected for safety routing", () => {
    assert.equal(detectCrisisLanguage("sometimes i feel like no reason to live"), true);
    assert.equal(detectCrisisLanguage("i want to kill myself"), true);
    assert.equal(detectCrisisLanguage("i am tired of my exams"), false);
    const result = classifyConcerns({ note: "i feel like no reason to live" });
    assert.equal(result.crisisDetected, true);
  });

  test("a financial concern routes to funding, not to breathing exercises", () => {
    const actions = actionsFor("financial");
    const targets = actions.map((a) => a.target).join(" ");
    assert.ok(targets.includes("/opportunities"), "financial must route to opportunities");
    assert.ok(targets.includes("/financial"));
  });

  test("top concerns are ordered and capped", () => {
    const result = classifyConcerns({
      note: "cannot pay tuition fees, final exams, final exams, no friends, lonely",
    });
    const top = topConcerns(result, 3);
    assert.ok(top.length <= 3);
    assert.ok(top[0].score >= top[top.length - 1].score);
  });

  test("PRODUCT INVARIANT: no clinical language is ever produced", () => {
    const notes = [
      "I am so depressed about my exams and I cannot pay my fees",
      "my anxiety is very bad because of cgpa pressure and no money",
      "i think i have depression and panic disorder because of tuition",
      "can't sleep, no friends, hopeless",
    ];
    for (const note of notes) {
      const result = classifyConcerns({ note });
      const produced = JSON.stringify({
        dominant: result.dominantConcern,
        scores: result.scores,
        evidence: result.evidence,
      }).toLowerCase();
      for (const term of BANNED_CLINICAL_TERMS) {
        assert.equal(
          produced.includes(term),
          false,
          `classifier leaked clinical term "${term}" for: ${note}`,
        );
      }
    }
  });

  test("empty input is safe", () => {
    const result = classifyConcerns({});
    assert.equal(result.dominantConcern, "other");
    assert.equal(result.crisisDetected, false);
    assert.equal(result.engineMode, "RULES");
  });
});
