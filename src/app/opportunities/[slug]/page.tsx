import Link from "next/link";
import { notFound } from "next/navigation";

import { NO_STUDENTS, resolveDemoStudent, withStudent } from "@/server/services/demo";
import {
  getMatchView,
  getOpportunityBySlug,
  toMatchInput,
} from "@/server/services/matching.service";
import { evaluateCriterion } from "@/domain/matching/engine";
import { DeadlineBadge, DeadlineSentence } from "@/components/deadline";
import { formatDeadlineDay, todayPK } from "@/domain/shared/dates";
import { Badge, Bar, ButtonLink, Callout, Card, Empty, PageHeader, Section, pkr } from "@/components/ui";

const REASON_LABELS: Record<string, string> = {
  CGPA_ABOVE_MIN: "Your academic result clears the minimum",
  HAT_SCORE_MET: "Your HAT score clears the minimum",
  INCOME_WITHIN_LIMIT: "You are within the published income limit",
  NEED_CRITERION_MET: "Your financial profile meets the need criterion",
  FIELD_ELIGIBLE: "Your field of study is eligible",
  AGE_ELIGIBLE: "You are within the age range",
  COVERAGE_FULL_FEE: "Covers full tuition",
  STIPEND_INCLUDED: "Includes a living allowance",
  DEADLINE_NEAR: "Deadline is approaching",
  DOCUMENTS_READY: "You already hold the documents",
  MERIT_BASED: "Merit-based award",
  NEED_BASED: "Need-based award",
  UNVERIFIED_SOURCE: "Listing not yet checked by an administrator",
  STALE_DATA: "Listing may be out of date",
};

const CAUTION_REASONS = new Set(["UNVERIFIED_SOURCE", "STALE_DATA"]);

const COMPONENT_LABELS: Record<string, string> = {
  NEED_FIT: "Financial need fit",
  COVERAGE_VALUE: "Coverage value",
  ACADEMIC_FIT: "Academic fit",
  FIELD_FIT: "Field fit",
  URGENCY: "Deadline urgency",
  EFFORT: "Application effort",
};

const TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "Scholarship",
  INTERNSHIP: "Internship",
  COMPETITION: "Competition",
  COURSE: "Course",
  FELLOWSHIP: "Fellowship",
  EXCHANGE: "Exchange",
};

const parseList = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** Criteria values are JSON; render them as a readable phrase, not raw JSON. */
function criterionValue(value: Record<string, unknown>): string {
  if (typeof value.gte === "number") {
    return `${value.gte}${typeof value.scale === "number" ? ` / ${value.scale}` : " or above"}`;
  }
  if (typeof value.lte === "number") return `${value.lte} or below`;
  if (typeof value.eq === "string") return value.eq.toLowerCase().replaceAll("_", " ");
  if (Array.isArray(value.in)) return value.in.join(", ");
  if (typeof value.eq === "number") return String(value.eq);
  return "see the official page";
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { slug } = await params;
  const { index, current } = await resolveDemoStudent(await searchParams);

  const row = await getOpportunityBySlug(slug);
  if (!row) notFound();
  if (!current) return <Empty>{NO_STUDENTS}</Empty>;

  const view = await getMatchView(current.email);
  const result = view?.summary.results.find((r) => r.opportunityId === row.id) ?? null;
  const categories = parseList(row.categories);
  const matchInput = view ? toMatchInput(view.student) : null;

  const verified = row.verificationStatus === "VERIFIED";

  return (
    <>
      <p className="text-sm">
        <Link href={withStudent("/opportunities", index)} className="text-zinc-500 hover:underline">
          ← All opportunities
        </Link>
      </p>

      <PageHeader eyebrow={TYPE_LABELS[row.type] ?? row.type} title={row.title} description={row.provider}>
        <div className="flex flex-wrap gap-2">
          <Badge variant={verified ? "outline" : "dotted"}>
            {verified ? "✓ verified listing" : "⚠ unverified listing"}
          </Badge>
          {categories.map((category) => (
            <Badge key={category} variant="muted">
              {category.toLowerCase().replaceAll("_", " ")}
            </Badge>
          ))}
          {row.countryCode && <Badge variant="muted">{row.countryCode}</Badge>}
          <DeadlineBadge deadline={row.deadline} />
        </div>
      </PageHeader>

      {/* Verification state is always visible — plan risk R1. */}
      <Callout
        tone={verified ? "note" : "caution"}
        title={verified ? "Checked against the official page" : "Nobody has checked this listing yet"}
      >
        {row.lastVerifiedAt
          ? `Last checked ${formatDeadlineDay(row.lastVerifiedAt)}.`
          : "No check date recorded."}{" "}
        {row.deadline ? (
          <>
            <DeadlineSentence deadline={row.deadline} /> The closing time matters: HEC portals shut at
            16:00 PKT, not at midnight. Requirements also change every cycle — confirm on the
            official page before you invest time in an application.
          </>
        ) : (
          <>
            <strong className="text-zinc-900">No deadline is shown.</strong> The awarding body
            either sets it locally (your university) or has not published this cycle&apos;s date.
            Neither is a reason to guess.
          </>
        )}
        {row.sourceUrl && (
          <>
            {" "}
            Source:{" "}
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              official page
            </a>
          </>
        )}
      </Callout>

      {/* ── Match result ─────────────────────────────────────────────────── */}
      {result && (
        <Section title="Where you stand">
          <Card
            title={
              result.eligible
                ? `You match this for ${current.name.split(" ")[0]}`
                : result.nearMiss
                  ? "Close — here is exactly what is missing"
                  : "Not eligible yet"
            }
            action={
              result.eligible ? (
                <span className="mm-num text-2xl font-semibold">{result.score}%</span>
              ) : result.nearMiss ? (
                <Badge variant="dotted">near-miss</Badge>
              ) : (
                <Badge variant="outline">✕ not eligible</Badge>
              )
            }
          >
            {result.eligible ? (
              <>
                <ul className="space-y-1">
                  {result.reasons.map((reason) => (
                    <li key={reason} className="text-sm text-zinc-700">
                      <span aria-hidden>{CAUTION_REASONS.has(reason) ? "⚠ " : "✓ "}</span>
                      {REASON_LABELS[reason] ?? reason}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-2">
                  {result.breakdown.map((component) => (
                    <div key={component.code}>
                      <div className="flex justify-between text-xs">
                        <span>
                          {COMPONENT_LABELS[component.code] ?? component.code}{" "}
                          <span className="text-zinc-400">weight {component.weight}</span>
                        </span>
                        <span className="mm-num text-zinc-600">
                          {component.points} / {component.weight}
                        </span>
                      </div>
                      <Bar value={component.points} className="mt-0.5" />
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  Adjusted by data freshness (×{result.freshnessFactor}) and how complete your
                  profile is (×{result.confidenceFactor}).{" "}
                  {result.unverifiedCriteria.length > 0 && (
                    <>
                      Assumed eligible on{" "}
                      {result.unverifiedCriteria.join(", ").toLowerCase().replaceAll("_", " ")} —
                      we had nothing to check those against.
                    </>
                  )}
                </p>
              </>
            ) : (
              <ul className="space-y-2">
                {result.disqualifiers.map((disqualifier) => (
                  <li key={disqualifier.code} className="text-sm">
                    <span aria-hidden>✕ </span>
                    <span className="font-medium">{disqualifier.label}:</span>{" "}
                    <span className="text-zinc-600">{disqualifier.humanText}</span>
                  </li>
                ))}
                {result.nearMiss && (
                  <li className="mt-3 text-xs text-zinc-600">
                    This is a small gap, not a closed door. It is shown as a near-miss rather than
                    hidden so you can judge whether closing it is realistic.
                  </li>
                )}
              </ul>
            )}
          </Card>
        </Section>
      )}

      {/* ── About ────────────────────────────────────────────────────────── */}
      <Section title="About this opportunity">
        <Card>
          <p className="text-sm leading-relaxed text-zinc-700">{row.description}</p>
          {row.scholarship && (
            <dl className="mm-rule mt-4 grid gap-2 pt-3 text-xs text-zinc-600 sm:grid-cols-2">
              {row.scholarship.tuitionCoverage && (
                <div className="flex justify-between">
                  <dt>Tuition</dt>
                  <dd>
                    {row.scholarship.tuitionCoverage === "FULL"
                      ? "fully covered"
                      : row.scholarship.tuitionCoverage === "PERCENT" &&
                          row.scholarship.tuitionCoveragePercent
                        ? `${row.scholarship.tuitionCoveragePercent}%`
                        : row.scholarship.tuitionCoverage.toLowerCase()}
                  </dd>
                </div>
              )}
              {row.scholarship.coversLiving && (
                <div className="flex justify-between">
                  <dt>Living costs</dt>
                  <dd>covered</dd>
                </div>
              )}
              {row.scholarship.coversTravel && (
                <div className="flex justify-between">
                  <dt>Travel</dt>
                  <dd>covered</dd>
                </div>
              )}
              {row.stipendMin && (
                <div className="flex justify-between">
                  <dt>Stipend from</dt>
                  <dd className="mm-num">{pkr(row.stipendMin)}</dd>
                </div>
              )}
            </dl>
          )}
          {row.applyUrl && (
            <div className="mt-4">
              <ButtonLink href={row.applyUrl}>Apply on the official site →</ButtonLink>
            </div>
          )}
        </Card>
      </Section>

      {/* ── Criteria, each evaluated against this student ────────────────── */}
      {matchInput && row.criteria.length > 0 && (
        <Section
          title="Eligibility requirements"
          description="Every published requirement, evaluated against your profile. Nothing here is decided by a language model."
        >
          <Card>
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Published rule</th>
                  <th className="text-right">Your position</th>
                </tr>
              </thead>
              <tbody>
                {row.criteria.map((criterion) => {
                  const outcome = evaluateCriterion(
                    {
                      code: criterion.code as never,
                      operator: criterion.operator as never,
                      value: parseObject(criterion.value),
                      required: criterion.required,
                      label: criterion.label ?? undefined,
                    },
                    matchInput,
                  );
                  return (
                    <tr key={criterion.id}>
                      <td className="font-medium">
                        {criterion.label ?? criterion.code.toLowerCase().replaceAll("_", " ")}
                      </td>
                      <td className="text-xs text-zinc-500">
                        {criterionValue(parseObject(criterion.value))}
                      </td>
                      <td className="text-right text-xs">
                        {!outcome.evaluable ? (
                          <Badge variant="dotted">assumed — add your details</Badge>
                        ) : outcome.passed ? (
                          <Badge variant="outline">✓ you match</Badge>
                        ) : (
                          <span className="text-zinc-600">
                            <span aria-hidden>✕ </span>
                            {outcome.disqualifier?.humanText}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      {row.documents.length > 0 && (
        <Section
          title="Documents you will need"
          description="Collect these early — most of the delay in these applications is document chasing, not writing."
        >
          <Card>
            <ul className="space-y-1 text-sm">
              {row.documents.map((document) => (
                <li key={document.id} className="flex items-center gap-2">
                  <span aria-hidden>{document.required ? "■" : "□"}</span>
                  {document.label}
                  <span className="text-xs text-zinc-500">
                    {document.required ? "required" : "optional"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mm-rule mt-3 pt-3 text-xs text-zinc-500">
              Checked as of {todayPK()}. Requirements change — confirm on the official page.
            </p>
          </Card>
        </Section>
      )}
    </>
  );
}