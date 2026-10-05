import Link from "next/link";
import {
  getMatchView,
  listDemoStudents,
  listOpportunities,
} from "@/server/services/matching.service";

const TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "Scholarship",
  INTERNSHIP: "Internship",
  COMPETITION: "Competition",
  COURSE: "Course",
  FELLOWSHIP: "Fellowship",
  EXCHANGE: "Exchange",
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; type?: string }>;
}) {
  const params = await searchParams;
  const students = await listDemoStudents();
  const index = Math.min(Math.max(Number(params.s ?? 0) || 0, 0), Math.max(students.length - 1, 0));
  const current = students[index];

  const [all, view] = await Promise.all([
    listOpportunities(),
    current ? getMatchView(current.email) : Promise.resolve(null),
  ]);

  const filtered = params.type ? all.filter((o) => o.type === params.type) : all;
  const scoreById = new Map(view?.summary.results.map((r) => [r.opportunityId, r]) ?? []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-slate-600">
          {all.length} public listings for students in Pakistan. Matched against{" "}
          {current?.name ?? "—"} using rule-based eligibility.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/opportunities?s=${index}`}
          className={`rounded-full border px-3 py-1 ${!params.type ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
        >
          All
        </Link>
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const count = all.filter((o) => o.type === type).length;
          if (count === 0) return null;
          return (
            <Link
              key={type}
              href={`/opportunities?s=${index}&type=${type}`}
              className={`rounded-full border px-3 py-1 ${params.type === type ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
            >
              {label} ({count})
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-600">No listings of this type yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {filtered.map((row) => {
            const result = scoreById.get(row.id);
            const categories: string[] = row.categories ? JSON.parse(row.categories) : [];
            return (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {TYPE_LABELS[row.type] ?? row.type}
                    </span>
                    {categories.map((category) => (
                      <span
                        key={category}
                        className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                      >
                        {category.toLowerCase().replaceAll("_", " ")}
                      </span>
                    ))}
                    {row.countryCode && (
                      <span className="text-xs text-slate-400">{row.countryCode}</span>
                    )}
                  </div>

                  <Link
                    href={`/opportunities/${row.slug}?s=${index}`}
                    className="mt-1 block font-medium hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="text-xs text-slate-500">{row.provider}</p>

                  {result && !result.eligible && (
                    <p className="mt-1 text-xs text-slate-500">
                      {result.disqualifiers.map((d) => d.humanText).join(" ")}
                    </p>
                  )}
                  {result?.eligible && result.unverifiedCriteria.length > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Assumed eligible — add {result.unverifiedCriteria.join(", ").toLowerCase()} to
                      confirm.
                    </p>
                  )}
                </div>

                <div className="text-right">
                  {result?.eligible ? (
                    <>
                      <p className="text-2xl font-semibold tabular-nums">{result.score}%</p>
                      <p className="text-xs text-emerald-700">eligible match</p>
                    </>
                  ) : result ? (
                    <p className="text-sm text-slate-400">
                      {result.nearMiss ? "near-miss" : "not eligible"}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-amber-700">unverified listing</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
