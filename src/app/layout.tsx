import type { Metadata } from "next";
import Link from "next/link";
import { listDemoStudents } from "@/server/services/matching.service";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindMate — Student Wellbeing & Opportunity Platform",
  description:
    "Wellbeing check-ins, transparent financial need scoring, a student budget planner, and rule-based scholarship matching for students in Pakistan.",
};

/**
 * Navigation is grouped by what the student is trying to do, not by which
 * table it comes from. "Where things are" is the complaint about tools like
 * this, so the grouping is the product.
 */
const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Overview",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    group: "Money",
    items: [
      { href: "/finances", label: "My plan" },
      { href: "/financial", label: "Need score" },
      { href: "/opportunities", label: "Funding" },
    ],
  },
  {
    group: "Me",
    items: [
      { href: "/onboarding", label: "My answers" },
      { href: "/checkin", label: "Check-in" },
      { href: "/support", label: "Support" },
    ],
  },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const students = await listDemoStudents();

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <header className="border-b border-zinc-900 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-end lg:justify-between">
            <Link href="/" className="block">
              <span className="text-lg font-semibold tracking-tight">MindMate</span>
              <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Pakistan
              </span>
              <p className="mm-eyebrow mt-0.5">
                Wellbeing · money · funding — in that order of urgency for you
              </p>
            </Link>

            <nav className="flex flex-wrap items-start gap-x-6 gap-y-2">
              {NAV.map((section) => (
                <div key={section.group}>
                  <p className="mm-eyebrow">{section.group}</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="text-zinc-700 hover:text-zinc-900 hover:underline">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          {/* Demo only: auth is not built yet (plan milestone M0/M1). Switching
              student here shows how need changes the match ranking. */}
          {students.length > 0 && (
            <div className="border-t border-zinc-200 bg-zinc-50">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-6 py-2 text-xs">
                <span className="mm-eyebrow">Demo student</span>
                {students.map((student, position) => (
                  <Link
                    key={student.email}
                    href={`/?s=${position}`}
                    className="mm-badge mm-badge-outline hover:bg-zinc-900 hover:text-white"
                  >
                    {student.name}
                    {student.needScore !== null && (
                      <span className="mm-num opacity-70">need {student.needScore}</span>
                    )}
                  </Link>
                ))}
                <span className="ml-auto text-zinc-500">
                  Public data · unverified listings are labelled
                </span>
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl border-t border-zinc-200 px-6 py-8">
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-600">
            <strong className="text-zinc-900">What this tool will not do.</strong> MindMate does
            not provide medical or mental-health advice, and it does not diagnose anything. It
            does not ask you to upload proof of your finances in order to register. It will not
            invent a scholarship, a requirement or a deadline — where a date is unconfirmed, the
            date is left blank. If you are in distress, please contact a counsellor or the
            emergency services listed under{" "}
            <Link href="/support" className="underline">
              Support
            </Link>
            .
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            Eligibility is decided by a published rule engine. No language model decides whether
            you qualify for anything.
          </p>
        </footer>
      </body>
    </html>
  );
}