/**
 * Demo student resolution.
 *
 * Auth is not built yet (plan milestone M0/M1), so the "current student" is a
 * query parameter. Every page needs the same clamping logic, and getting it
 * wrong means showing one student's financial data next to another's — so it
 * lives in exactly one place.
 */

import { listDemoStudents, type DemoStudentRef } from "./matching.service";

export interface DemoContext {
  students: DemoStudentRef[];
  index: number;
  current: DemoStudentRef | null;
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export async function resolveDemoStudent(
  searchParams: { s?: string | string[] } | undefined,
): Promise<DemoContext> {
  const students = await listDemoStudents();
  const raw = Number(first(searchParams?.s) ?? 0);
  const index = Math.min(
    Number.isFinite(raw) ? Math.max(Math.trunc(raw), 0) : 0,
    Math.max(students.length - 1, 0),
  );
  return { students, index, current: students[index] ?? null };
}

/** Appends the demo student index to an internal link. */
export function withStudent(href: string, index: number): string {
  if (href.startsWith("http")) return href;
  return `${href}${href.includes("?") ? "&" : "?"}s=${index}`;
}

/** Used when there is nothing to show yet — one place to phrase it. */
export const NO_STUDENTS =
  "No demo students found. Run `npm run db:seed` to load the sample profiles.";