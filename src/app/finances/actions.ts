"use server";

/**
 * Budget submission.
 *
 * Only the student's own numbers are stored. The plan is a pure function of
 * those numbers (src/domain/finance/planner.ts) and is recomputed on read, so
 * there is no stored advice to drift out of date.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db/client";
import { EXPENSE_CODES, EXPENSE_LABELS } from "@/server/services/planning.service";

const MAX_ROWS = 20;
const MAX_AMOUNT = 5_000_000;

const amount = z.coerce
  .number({ error: "Enter a number" })
  .min(0, "Cannot be negative")
  .max(MAX_AMOUNT, "That looks too large — check the figure");

const label = z
  .string()
  .trim()
  .min(1, "Required")
  .max(60, "Keep it under 60 characters");

const schema = z.object({
  email: z.string().email(),
  incomeLabel: z.array(label).max(MAX_ROWS),
  incomeAmount: z.array(amount).max(MAX_ROWS),
  incomeKind: z.array(z.enum(["STABLE", "VARIABLE"])).max(MAX_ROWS),
  expenseCode: z.array(z.enum(EXPENSE_CODES)).max(MAX_ROWS),
  expenseLabel: z.array(label).max(MAX_ROWS),
  expenseMonthly: z.array(amount).max(MAX_ROWS),
  expenseEssential: z.array(z.enum(["YES", "NO"])).max(MAX_ROWS),
  annualTuition: amount,
  termsPerYear: z.coerce.number().int().min(1).max(4),
  bufferTargetMonths: z.coerce.number().int().min(1).max(12),
});

export interface BudgetState {
  status: "idle" | "saved" | "error";
  message?: string;
  issues?: Record<string, string>;
}

const many = (form: FormData, key: string): string[] =>
  form
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim());

export async function saveBudget(
  _previous: BudgetState,
  form: FormData,
): Promise<BudgetState> {
  const parsed = schema.safeParse({
    email: form.get("email"),
    incomeLabel: many(form, "incomeLabel[]"),
    incomeAmount: many(form, "incomeAmount[]"),
    incomeKind: many(form, "incomeKind[]"),
    expenseCode: many(form, "expenseCode[]"),
    expenseLabel: many(form, "expenseLabel[]"),
    expenseMonthly: many(form, "expenseMonthly[]"),
    expenseEssential: many(form, "expenseEssential[]"),
    annualTuition: form.get("annualTuition") ?? 0,
    termsPerYear: form.get("termsPerYear") ?? 2,
    bufferTargetMonths: form.get("bufferTargetMonths") ?? 3,
  });

  if (!parsed.success) {
    const issues: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      issues[key] ??= issue.message;
    }
    return {
      status: "error",
      message: "Some figures need fixing. Nothing was saved.",
      issues,
    };
  }

  const input = parsed.data;

  // Zip the parallel arrays. A row is only kept when all four parts are present
  // and it carries a real amount — a half-filled row is a mistake, not data.
  const incomeSources = input.incomeLabel
    .map((rowLabel, position) => ({
      label: rowLabel,
      monthly: input.incomeAmount[position] ?? 0,
      stable: input.incomeKind[position] === "STABLE",
    }))
    .filter((row) => row.monthly > 0);

  const expenses = input.expenseCode
    .map((code, position) => ({
      code,
      label: input.expenseLabel[position] || EXPENSE_LABELS[code],
      monthly: input.expenseMonthly[position] ?? 0,
      essential: input.expenseEssential[position] === "YES",
    }))
    .filter((row) => row.monthly > 0);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    return { status: "error", message: "Unknown student. Nothing was saved." };
  }

  await prisma.budgetPlan.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      incomeSources: JSON.stringify(incomeSources),
      expenses: JSON.stringify(expenses),
      annualTuition: input.annualTuition,
      termsPerYear: input.termsPerYear,
      bufferTargetMonths: input.bufferTargetMonths,
    },
    update: {
      incomeSources: JSON.stringify(incomeSources),
      expenses: JSON.stringify(expenses),
      annualTuition: input.annualTuition,
      termsPerYear: input.termsPerYear,
      bufferTargetMonths: input.bufferTargetMonths,
    },
  });

  revalidatePath("/", "layout");
  return {
    status: "saved",
    message: "Plan recalculated from your figures.",
  };
}