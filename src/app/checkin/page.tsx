import Link from "next/link";
import {
  getWellbeing,
  listDemoStudents,
} from "@/server/services/matching.service";
import {
  actionsFor,
  CATEGORY_LABELS,
  CONCERN_CATEGORIES,
  type ConcernCategory,
} from "@/domain/wellbeing/classifier";
import { createCheckin } from "./actions";

const MOODS = [
  { code: "GOOD", label: "😊 Good" },
  { code: "OK", label: "🙂 Okay" },
  { code: "NEUTRAL", label: "😐 Neutral" },
  { code: "STRESSED", label: "😟 Stressed" },
  { code: "VERY_STRESSED", label: "😞 Very stressed" },
];

const FACTOR_LABELS: Record<string, string> = {
  EXAMS: "Exams",
  ASSIGNMENT: "Assignments",
  MONEY: "Money",
  CAREER: "Career",
  FAMILY: "Family",
  RELATIONSHIPS: "Relationships",
  LONELINESS: "Loneliness",
  SLEEP: "Sleep",
  HEALTH: "Health",
  OTHER: "Other",
};

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const params = await searchParams;
  const students = await listDemoStudents();
  const index = Math.min(Math.max(Number(params.s ?? 0) || 0, 0), Math.max(students.length - 1, 0));
  const current = students[index];
  if (!current) return <p className="text-slate-600">No demo students. Run: npm run db:seed</p>;

  const wellbeing = await getWellbeing(current.email);
  const latest = wellbeing.latest;
  const dominant = latest?.dominantConcern as ConcernCategory | null | undefined;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Daily check-in</h1>
        <p className="text-sm text-slate-600">
          {current.name} · this classifies your situation, it does not diagnose anything
        </p>
      </header>

      {latest?.crisisDetected && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">Please talk to someone today</h2>
          <p className="mt-1 text-sm text-red-800">
            Your last note suggests you may be in distress. These services are free and
            confidential.
          </p>
          <Link
            href="/support"
            className="mt-3 inline-block rounded bg-red-700 px-4 py-2 text-sm font-medium text-white"
          >
            See crisis contacts now
          </Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-medium">How are you feeling today?</h2>
          <form action={createCheckin} className="mt-4 space-y-4">
            <input type="hidden" name="email" value={current.email} />

            <div className="flex flex-wrap gap-2">
              {MOODS.map((mood, position) => (
                <label
                  key={mood.code}
                  className="cursor-pointer rounded border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white"
                >
                  <input
                    type="radio"
                    name="moodCode"
                    value={mood.code}
                    defaultChecked={position === 2}
                    className="sr-only"
                  />
                  {mood.label}
                </label>
              ))}
            </div>

            <div>
              <label htmlFor="stressLevel" className="text-sm text-slate-600">
                Stress level: <span className="font-medium text-slate-900">5</span>/10
              </label>
              <input
                id="stressLevel"
                name="stressLevel"
                type="range"
                min={1}
                max={10}
                defaultValue={5}
                className="mt-1 w-full"
              />
            </div>

            <fieldset>
              <legend className="text-sm text-slate-600">What is affecting you?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(FACTOR_LABELS).map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="tags" value={code} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Ticking a box is treated as a label — it takes priority over the text analysis.
              </p>
            </fieldset>

            <div>
              <label htmlFor="note" className="text-sm text-slate-600">
                Anything you want to add? (optional)
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                placeholder="e.g. My semester fees are due and I am not sure how I will manage."
              />
              <p className="mt-1 text-xs text-slate-500">
                Stored privately. Never shown to staff or administrators.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              Save check-in
            </button>
          </form>
        </section>

        {/* Results */}
        <div className="space-y-6 lg:col-span-3">
          {latest && (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">Latest analysis</h2>
                <span className="text-xs text-slate-400">{latest.day}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">
                    {latest.stressLevel}
                    <span className="text-base text-slate-400">/10</span>
                  </p>
                  <p className="text-xs text-slate-500">stress</p>
                </div>
                {dominant && (
                  <div>
                    <p className="text-3xl font-semibold">
                      {CATEGORY_LABELS[dominant]}
                    </p>
                    <p className="text-xs text-slate-500">
                      top concern{latest.confidence !== null && ` (${Math.round(latest.confidence * 100)}% of evidence)`}
                    </p>
                  </div>
                )}
              </div>

              {latest.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {latest.tags.map((tag) => (
                    <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                      {FACTOR_LABELS[tag] ?? tag}
                    </span>
                  ))}
                </div>
              )}

              {latest.scores && (
                <div className="mt-4 space-y-1">
                  {CONCERN_CATEGORIES.filter((c) => (latest.scores?.[c] ?? 0) > 0).map((category) => (
                    <div key={category} className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 text-slate-500">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className="block h-full bg-indigo-400"
                          style={{
                            width: `${Math.min(100, (latest.scores?.[category] ?? 0) * 20)}%`,
                          }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">
                        {(latest.scores?.[category] ?? 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {dominant && (
            <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
              <h2 className="font-medium text-indigo-900">
                What would actually help with {CATEGORY_LABELS[dominant].toLowerCase()}
              </h2>
              <ul className="mt-3 space-y-2">
                {actionsFor(dominant).map((action) => (
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

          {wellbeing.history.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-medium">Your trend</h2>
              <p className="text-xs text-slate-500">
                {wellbeing.history.length} recent check-ins · average stress{" "}
                {wellbeing.averageStress}/10
              </p>
              <div className="mt-3 flex items-end gap-1">
                {wellbeing.history.map((entry) => (
                  <div key={entry.day} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs tabular-nums text-slate-500">{entry.stressLevel}</span>
                    <span
                      className="w-full rounded-t bg-indigo-400"
                      style={{ height: `${entry.stressLevel * 8}px` }}
                    />
                    <span className="text-[10px] text-slate-400">{entry.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
