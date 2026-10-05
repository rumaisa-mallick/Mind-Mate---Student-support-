import Link from "next/link";
import {
  getMatchView,
  listDemoStudents,
} from "@/server/services/matching.service";
import {
  PK_INCOME_BANDS_MONTHLY,
  PK_WEIGHT_SET_V1,
} from "@/config/pakistan";

const FACTOR_EXPLAINERS: Record<string, string> = {
  INCOME: "Where the household income band sits, on a scale anchored to Pakistan.",
  DEPENDENTS: "How many people are supported on that income.",
  EARNERS: "How many family members contribute earnings.",
  TUITION_BURDEN: "Annual tuition relative to typical Pakistani tuition ranges.",
  ACCOMMODATION: "Self-funded accommodation cost. Living free at home scores zero.",
  EXISTING_AID: "Support already received — full existing aid reduces the estimate.",
};

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const params = await searchParams;
  const students = await listDemoStudents();
  const index = Math.min(Math.max(Number(params.s ?? 0) || 0, 0), Math.max(students.length - 1, 0));
  const current = students[index];
  if (!current) return <p className="text-slate-600">No demo students. Run: npm run db:seed</p>;

  const view = await getMatchView(current.email);
  if (!view) return <p className="text-slate-600">Student not found.</p>;

  const { need } = view;
  const totalPoints = need.contributions.reduce((sum, c) => sum + c.points, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Financial support</h1>
        <p className="text-sm text-slate-600">
          {current.name} · every point below is attributable to a named factor
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Estimated financial need</p>
            <p className="text-5xl font-semibold tabular-nums">
              {need.score}
              <span className="text-xl text-slate-400">/100</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Band</p>
            <p className="font-medium">{need.bandLabel}</p>
            <p className="mt-1 text-xs text-slate-500">
              weight set v{need.weightSetVersion} · {Math.round(need.inputCoverage * 100)}% of
              weights backed by data
            </p>
          </div>
        </div>

        <p className="mt-4 rounded bg-slate-50 p-3 text-sm text-slate-700">{need.headline}</p>

        <div className="mt-6 space-y-4">
          {need.contributions.map((contribution) => (
            <div key={contribution.code}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {contribution.label}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    weight {contribution.weight}
                  </span>
                </span>
                <span className="tabular-nums text-slate-600">
                  {contribution.points} pts · normalised {contribution.normalised}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${contribution.normalised * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {FACTOR_EXPLAINERS[contribution.code]}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Points sum to {totalPoints.toFixed(1)} of a 100-point score.
        </p>

        {need.missing.length > 0 && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Missing {need.missing.join(", ").toLowerCase().replaceAll("_", " ")} — the score
            above renormalises the remaining weights rather than guessing. Add these details
            for a more accurate result.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-medium">What this unlocks</h2>
        <p className="mt-1 text-sm text-slate-600">
          Scholarships with a financial-need criterion are matched against this score by the
          rule engine — nothing is decided by a language model.
        </p>
        <Link
          href={`/opportunities?s=${index}`}
          className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          See matched opportunities
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-medium">How the scale is defined (Pakistan)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {PK_INCOME_BANDS_MONTHLY.map((band) => (
                <tr key={band.code} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{band.code}</td>
                  <td className="py-1.5">{band.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Anchors: need factor = 1.0 at or below{" "}
          {PK_WEIGHT_SET_V1.anchors.incomeLowAnchor.toLocaleString()} PKR/month, 0.0 at or above{" "}
          {PK_WEIGHT_SET_V1.anchors.incomeHighAnchor.toLocaleString()} PKR/month. Bands: under{" "}
          {PK_WEIGHT_SET_V1.bands.low} low, under {PK_WEIGHT_SET_V1.bands.moderate} moderate,
          under {PK_WEIGHT_SET_V1.bands.high} high, otherwise very high.
        </p>
      </section>
    </div>
  );
}
