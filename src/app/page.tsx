import Link from "next/link";
import {
  getMatchView,
  getWellbeing,
  listDemoStudents,
} from "@/server/services/matching.service";
import { actionsFor, CATEGORY_LABELS, type ConcernCategory } from "@/domain/wellbeing/classifier";

const BAND_STYLES: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const REASON_LABELS: Record<string, string> = {
  CGPA_ABOVE_MIN: "Your academic result clears the minimum",
  NEED_CRITERION_MET: "Your financial profile meets the need criterion",
  FIELD_ELIGIBLE: "Your field of study is eligible",
  AGE_ELIGIBLE: "You are within the age range",
  COVERAGE_FULL_FEE: "Covers full tuition",
  STIPEND_INCLUDED: "Includes a living allowance",
  DEADLINE_NEAR: "Deadline is approaching",
  DOCUMENTS_READY: "You already have the documents",
  MERIT_BASED: "Merit-based award",
  NEED_BASED: "Need-based award",
  UNVERIFIED_SOURCE: "Listing not yet verified by an administrator",
  STALE_DATA: "This listing may be out of date",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 shrink-0 text-slate-500">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <span
          className="block h-full rounded-full bg-indigo-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right tabular-nums text-slate-600">
        {Math.round(value)}
      </span>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const params = await searchParams;
  const students = await listDemoStudents();
  const index = Math.min(Math.max(Number(params.s ?? 0) || 0, 0), Math.max(students.length - 1, 0));
  const current = students[index];

  if (!current) {
    return <p className="text-slate-600">No demo students found. Run: npm run db:seed</p>;
  }

  const view = await getMatchView(current.email);
  const wellbeing = await getWellbeing(current.email);
  if (!view) return <p className="text-slate-600">Student not found.</p>;

  const latest = wellbeing.latest;
  const dominant = latest?.dominantConcern as ConcernCategory | null | undefined;
  const remedies = dominant ? actionsFor(dominant) : [];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {current.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-600">
          {view.student.studentProfile?.university} ·{" "}
          {view.student.studentProfile?.degree} · semester{" "}
          {view.student.studentProfile?.currentSemester}
        </p>
      </section>

      {latest?.crisisDetected && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">You are not in trouble for feeling this way</h2>
          <p className="mt-1 text-sm text-red-800">
            Your last entry suggests you may be in distress. These services are free,
            confidential and available now.
          </p>
          <Link
            href="/support"
            className="mt-3 inline-block rounded bg-red-700 px-4 py-2 text-sm font-medium text-white"
          >
            See support and crisis contacts
          </Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Financial need */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-medium text-slate-500">Financial need</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLES[view.need.band]}`}
            >
              {view.need.bandLabel}
            </span>
          </div>
          <p className="mt-2 text-4xl font-semibold tabular-nums">
            {view.need.score}
            <span className="text-lg text-slate-400">/100</span>
          </p>
          <p className="mt-2 text-sm text-slate-600">{view.need.headline}</p>
          {view.need.provisional && (
            <p className="mt-2 text-xs text-amber-700">
              Missing: {view.need.missing.join(", ").toLowerCase().replaceAll("_", " ")}
            </p>
          )}
          <Link href="/financial" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
            See the full breakdown →
          </Link>
        </section>

        {/* Wellbeing */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-500">Wellbeing</h2>
          {latest ? (
            <>
              <p className="mt-2 text-4xl font-semibold tabular-nums">
                {latest.stressLevel}
                <span className="text-lg text-slate-400">/10</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Latest check-in on {latest.day}
                {wellbeing.averageStress !== null && ` · recent average ${wellbeing.averageStress}`}
              </p>
              {dominant && (
                <p className="mt-2 text-sm">
                  <span className="text-slate-500">Top concern: </span>
                  <span className="font-medium">{CATEGORY_LABELS[dominant]}</span>
                </p>
              )}
              <Link href="/checkin" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
                Check in and view your trend →
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No check-ins yet.</p>
          )}
        </section>

        {/* Matches */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-500">Opportunities for you</h2>
          <p className="mt-2 text-4xl font-semibold tabular-nums">
            {view.summary.eligibleCount}
            <span className="text-lg text-slate-400"> eligible</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            from {view.summary.totalCandidates} public listings
            {view.nearMisses.length > 0 && ` · ${view.nearMisses.length} near-miss`}
          </p>
          {view.summary.usedAssumptions && (
            <p className="mt-2 text-xs text-amber-700">
              Some listings were assumed eligible because your profile is incomplete.
            </p>
          )}
          <Link
            href={`/opportunities?s=${index}`}
            className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
          >
            Browse all opportunities →
          </Link>
        </section>
      </div>

      {/* Concern → remedy */}
      {dominant && remedies.length > 0 && (
        <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="font-medium text-indigo-900">
            Because your top concern is {CATEGORY_LABELS[dominant].toLowerCase()}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {remedies.map((action) => (
              <li key={action.target + action.remedy}>
                <Link
                  href={`${action.target}${action.target.includes("?") ? "&" : "?"}s=${index}`}
                  className="block rounded border border-indigo-200 bg-white p-3 text-sm hover:border-indigo-400"
                >
                  {action.remedy}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Top matches */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Top matches</h2>
          <span className="text-xs text-slate-500">
            Rule-based eligibility · engine {view.summary.engineVersion}
          </span>
        </div>

        {view.ranked.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
            No eligible opportunities yet — complete your profile to improve matching.
          </p>
        ) : (
          <ol className="space-y-3">
            {view.ranked.slice(0, 5).map(({ row, result }, position) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">{position + 1}</p>
                    <Link
                      href={`/opportunities/${row.slug}?s=${index}`}
                      className="font-medium hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="text-xs text-slate-500">{row.provider}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums">{result.score}%</p>
                    <p className="text-xs text-slate-500">match score</p>
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {result.reasons.map((reason) => (
                    <li
                      key={reason}
                      className={
                        reason === "UNVERIFIED_SOURCE" || reason === "STALE_DATA"
                          ? "rounded bg-amber-50 px-2 py-1 text-amber-800"
                          : "rounded bg-emerald-50 px-2 py-1 text-emerald-800"
                      }
                    >
                      {REASON_LABELS[reason] ?? reason}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 grid gap-1">
                  {result.breakdown.map((component) => (
                    <ScoreBar
                      key={component.code}
                      label={`${component.code.toLowerCase().replaceAll("_", " ")} (weight ${component.weight})`}
                      value={component.points}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Deadlines: honest about missing data */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Upcoming deadlines are not shown.</strong> Seeded listings intentionally have
        no deadline until an administrator confirms it from the official source. Showing a
        guessed date would be worse than showing none.
      </section>
    </div>
  );
}
