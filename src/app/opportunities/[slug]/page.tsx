import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMatchView,
  getOpportunityBySlug,
  listDemoStudents,
  todayISO,
} from "@/server/services/matching.service";
import { evaluateCriterion, formatNumber } from "@/domain/matching/engine";
import { toMatchInput } from "@/server/services/matching.service";

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

const COMPONENT_LABELS: Record<string, string> = {
  NEED_FIT: "Financial need fit",
  COVERAGE_VALUE: "Coverage value",
  ACADEMIC_FIT: "Academic fit",
  FIELD_FIT: "Field fit",
  URGENCY: "Deadline urgency",
  EFFORT: "Application effort",
};

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { slug } = await params;
  const { s } = await searchParams;

  const row = await getOpportunityBySlug(slug);
  if (!row) notFound();

  const students = await listDemoStudents();
  const index = Math.min(Math.max(Number(s ?? 0) || 0, 0), Math.max(students.length - 1, 0));
  const current = students[index];

  const view = current ? await getMatchView(current.email) : null;
  const result = view?.summary.results.find((r) => r.opportunityId === row.id);
  const categories: string[] = row.categories ? JSON.parse(row.categories) : [];
  const matchInput = view ? toMatchInput(view.student) : null;

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href={`/opportunities?s=${index}`} className="text-slate-500 hover:underline">
          ← All opportunities
        </Link>
      </div>

      <header>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-0.5">{row.type}</span>
          {categories.map((category) => (
            <span key={category} className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700">
              {category.toLowerCase().replaceAll("_", " ")}
            </span>
          ))}
          {row.countryCode && <span className="text-slate-400">{row.countryCode}</span>}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{row.title}</h1>
        <p className="text-sm text-slate-600">{row.provider}</p>
      </header>

      {/* Verification state is always visible — plan risk R1. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>
          {row.verificationStatus === "VERIFIED" ? "Verified listing" : "Unverified listing"}
        </strong>{" "}
        —{" "}
        {row.lastVerifiedAt
          ? `last checked ${row.lastVerifiedAt.toISOString().slice(0, 10)}.`
          : "not yet checked by an administrator."}{" "}
        Always confirm the current requirements and deadline on the official page
        {row.sourceUrl && (
          <>
            {" "}
            (
            <a href={row.sourceUrl} className="underline" target="_blank" rel="noreferrer">
              source
            </a>
            )
          </>
        )}
        . Deadline is not shown because it has not been confirmed.
      </div>

      {/* Match result */}
      {result && (
        <section
          className={`rounded-lg border p-5 ${
            result.eligible
              ? "border-emerald-200 bg-emerald-50"
              : result.nearMiss
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-white"
          }`}
        >
          {result.eligible ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-medium text-emerald-900">
                  You match this opportunity for {current?.name.split(" ")[0]}
                </h2>
                <p className="text-3xl font-semibold tabular-nums text-emerald-900">
                  {result.score}%
                </p>
              </div>

              <ul className="mt-3 space-y-1">
                {result.reasons.map((reason) => (
                  <li key={reason} className="text-sm text-emerald-800">
                    ✓ {REASON_LABELS[reason] ?? reason}
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-2">
                {result.breakdown.map((component) => (
                  <div key={component.code} className="text-xs">
                    <div className="flex justify-between">
                      <span>
                        {COMPONENT_LABELS[component.code] ?? component.code}{" "}
                        <span className="text-slate-400">weight {component.weight}</span>
                      </span>
                      <span className="tabular-nums">{component.points} pts</span>
                    </div>
                    <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, component.points)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-emerald-700">
                Adjusted by data freshness (×{result.freshnessFactor}) and profile completeness
                (×{result.confidenceFactor}).
              </p>
            </>
          ) : (
            <>
              <h2 className="font-medium">
                {result.nearMiss ? "You are very close — worth a look" : "Not eligible yet"}
              </h2>
              <ul className="mt-2 space-y-2">
                {result.disqualifiers.map((disqualifier) => (
                  <li key={disqualifier.code} className="text-sm">
                    <span className="font-medium">{disqualifier.label}:</span>{" "}
                    <span className="text-slate-700">{disqualifier.humanText}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-medium">About this opportunity</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{row.description}</p>
        {row.applyUrl && (
          <a
            href={row.applyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Apply on the official site →
          </a>
        )}
      </section>

      {/* Eligibility criteria, each shown with this student's evaluation */}
      {matchInput && row.criteria.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-medium">Eligibility requirements</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {row.criteria.map((criterion) => {
                const outcome = evaluateCriterion(
                  {
                    code: criterion.code as never,
                    operator: criterion.operator as never,
                    value: JSON.parse(criterion.value),
                    required: criterion.required,
                    label: criterion.label ?? undefined,
                  },
                  matchInput,
                );
                return (
                  <tr key={criterion.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">
                        {criterion.label ?? criterion.code.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-slate-400">{JSON.stringify(JSON.parse(criterion.value))}</span>
                    </td>
                    <td className="py-2 text-right">
                      {!outcome.evaluable ? (
                        <span className="text-xs text-amber-700">assumed — add your details</span>
                      ) : outcome.passed ? (
                        <span className="text-emerald-700">✓ you match</span>
                      ) : (
                        <span className="text-slate-500">✕ {outcome.disqualifier?.humanText}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {row.documents.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-medium">Documents you will need</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {row.documents.map((document) => (
              <li key={document.id} className="flex items-center gap-2">
                <span aria-hidden>📄</span>
                {document.label}
                {document.required && <span className="text-xs text-slate-400">required</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Checked as of {todayISO()}. Requirements change — confirm on the official page.
          </p>
        </section>
      )}
    </div>
  );
}
