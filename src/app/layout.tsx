import type { Metadata } from "next";
import Link from "next/link";
import { listDemoStudents } from "@/server/services/matching.service";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindMate — Student Wellbeing & Opportunity Platform",
  description:
    "Wellbeing check-ins, transparent financial need scoring, and rule-based scholarship matching for students in Pakistan.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/financial", label: "Financial" },
  { href: "/checkin", label: "Check-in" },
  { href: "/support", label: "Support" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const students = await listDemoStudents();

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/" className="text-lg font-semibold tracking-tight">
                MindMate
              </Link>
              <p className="text-xs text-slate-500">
                Wellbeing · Financial support · Opportunities
              </p>
            </div>

            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Demo only: auth is not built yet (plan milestone M0/M1). Switching
              student here shows how need changes the match ranking. */}
          {students.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-100/70">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-6 py-2 text-xs">
                <span className="font-medium text-slate-500">Demo student:</span>
                {students.map((student) => (
                  <Link
                    key={student.email}
                    href={`/?s=${students.indexOf(student)}`}
                    className="rounded border border-slate-300 bg-white px-2 py-1 hover:border-slate-400"
                  >
                    {student.name}
                    {student.needScore !== null && (
                      <span className="ml-1 text-slate-500">need {student.needScore}</span>
                    )}
                  </Link>
                ))}
                <span className="ml-auto text-slate-400">
                  Public data · unverified listings are labelled
                </span>
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs leading-relaxed text-slate-500">
          <p>
            MindMate does not provide medical or mental-health advice, and it does not
            diagnose anything. It helps you find funding, university services and
            information. If you are in distress, please contact a counsellor or the
            emergency services listed under Support.
          </p>
        </footer>
      </body>
    </html>
  );
}
