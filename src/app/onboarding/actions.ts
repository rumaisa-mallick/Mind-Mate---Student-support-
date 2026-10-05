"use server";

/**
 * Onboarding submission.
 *
 * Validation is strict and the write is a plain upsert — no AI is involved in
 * reading these answers. Personalisation changes ordering, tone and depth;
 * it never changes eligibility (see src/domain/personalisation/profile.ts).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db/client";

const GOALS = ["FINANCE", "ACADEMIC", "CAREER", "WELLBEING"] as const;
const SUPPORT = ["SELF_GUIDED", "PEER", "PROFESSIONAL"] as const;
const STYLES = ["INTENSIVE", "STEADY", "SPACED"] as const;
const WORK = ["NONE", "PART_TIME", "FULL_TIME"] as const;
const TONES = ["DIRECT", "GENTLE", "DETAILED"] as const;

/** Pressures we have vocabulary for. Free-text triggers are not accepted. */
const TRIGGERS = [
  "MONEY",
  "EXAMS",
  "ASSIGNMENT",
  "CAREER",
  "FAMILY",
  "RELATIONSHIPS",
  "LONELINESS",
  "SLEEP",
  "HEALTH",
  "HOUSING",
  "TRANSPORT",
] as const;

const oneOf = (allowed: readonly string[]) =>
  z.string().refine((value) => allowed.includes(value), { message: "Unrecognised option" });

const boundedNumber = (min: number, max: number) =>
  z.coerce.number({ error: "Enter a number" }).int().min(min).max(max);

const schema = z.object({
  email: z.string().email(),
  primaryGoal: oneOf(GOALS),
  secondaryGoals: z.array(oneOf(GOALS)).max(3).default([]),
  stressTriggers: z.array(oneOf(TRIGGERS)).max(6).default([]),
  supportPreference: oneOf(SUPPORT),
  availableHoursPerWeek: boundedNumber(1, 80),
  studyStyle: oneOf(STYLES),
  commuteMinutes: boundedNumber(0, 240),
  workCommitment: oneOf(WORK),
  caresForOthers: z.boolean(),
  tonePreference: oneOf(TONES),
  preferredLanguage: oneOf(["en", "ur"]),
});

export interface OnboardingState {
  status: "idle" | "saved" | "error";
  message?: string;
  /** Field-level problems, keyed by form field name. */
  issues?: Record<string, string>;
}

const text = (form: FormData, key: string): string => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const many = (form: FormData, key: string): string[] =>
  form
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

export async function savePersonalisation(
  _previous: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse({
    email: text(form, "email"),
    primaryGoal: text(form, "primaryGoal"),
    secondaryGoals: many(form, "secondaryGoals"),
    stressTriggers: many(form, "stressTriggers"),
    supportPreference: text(form, "supportPreference"),
    availableHoursPerWeek: text(form, "availableHoursPerWeek"),
    studyStyle: text(form, "studyStyle"),
    commuteMinutes: text(form, "commuteMinutes"),
    workCommitment: text(form, "workCommitment"),
    // An unchecked box is simply absent, so presence is the value.
    caresForOthers: form.get("caresForOthers") === "on" || form.get("caresForOthers") === "true",
    tonePreference: text(form, "tonePreference"),
    preferredLanguage: text(form, "preferredLanguage"),
  });

  if (!parsed.success) {
    const issues: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      issues[key] ??= issue.message;
    }
    return {
      status: "error",
      message: "Some answers need fixing. Nothing was saved.",
      issues,
    };
  }

  const answers = parsed.data;

  // A secondary goal that repeats the primary one is not a second priority.
  const secondaryGoals = answers.secondaryGoals.filter((goal) => goal !== answers.primaryGoal);

  const user = await prisma.user.findUnique({ where: { email: answers.email } });
  if (!user) {
    return { status: "error", message: "Unknown student. Nothing was saved." };
  }

  await prisma.personalisationProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      primaryGoal: answers.primaryGoal,
      secondaryGoals: JSON.stringify(secondaryGoals),
      stressTriggers: JSON.stringify(answers.stressTriggers),
      supportPreference: answers.supportPreference,
      availableHoursPerWeek: answers.availableHoursPerWeek,
      studyStyle: answers.studyStyle,
      commuteMinutes: answers.commuteMinutes,
      workCommitment: answers.workCommitment,
      caresForOthers: answers.caresForOthers,
      tonePreference: answers.tonePreference,
      preferredLanguage: answers.preferredLanguage,
      completedAt: new Date(),
    },
    update: {
      primaryGoal: answers.primaryGoal,
      secondaryGoals: JSON.stringify(secondaryGoals),
      stressTriggers: JSON.stringify(answers.stressTriggers),
      supportPreference: answers.supportPreference,
      availableHoursPerWeek: answers.availableHoursPerWeek,
      studyStyle: answers.studyStyle,
      commuteMinutes: answers.commuteMinutes,
      workCommitment: answers.workCommitment,
      caresForOthers: answers.caresForOthers,
      tonePreference: answers.tonePreference,
      preferredLanguage: answers.preferredLanguage,
      completedAt: new Date(),
    },
  });

  revalidatePath("/", "layout");
  return {
    status: "saved",
    message: "Saved. Your dashboard has been reordered around these answers.",
  };
}