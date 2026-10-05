import Link from "next/link";
import { getMatchView, getWellbeing } from "@/server/services/matching.service";
import { getPlanningView } from "@/server/services/planning.service";
import { NO_STUDENTS, resolveDemoStudent, withStudent } from "@/server/services/demo";
import { actionsFor, CATEGORY_LABELS, type ConcernCategory } from "@/domain/wellbeing/classifier";
import { PRIORITY_LABELS } from "@/domain/personalisation/profile";
import {
  Badge,
  Bar,
  ButtonLink,
  Callout,
  Card,
  Empty,
  LinkRow,
  PageHeader,
  Section,
  Stat,
  pkr,
} from "@/components/ui";

const REASON_LABELS: Record<string, string> = {
  CGPA_ABOVE_MIN: "Academic result clears the minimum",
  HAT_SCORE_MET: "HAT score clears the minimum",
  INCOME_WITHIN_LIMIT: "Within the published income limit",
  NEED_CRITERION_MET: "Financial profile meets the need criterion",
  FIELD_ELIGIBLE: "Your field of study is eligible",
  AGE_ELIGIBLE: "Within the age range",
  COVERAGE_FULL_FEE: "Covers full tuition",
  STIPEND_INCLUDED: "Includes a living allowance",
  DEADLINE_NEAR: "Deadline is approaching",
  DOCUMENTS_READY: "You already hold the documents",
  MERIT_BASED: "Merit-based award",
  NEED_BASED: "Need-based award",
  UNVERIFIED_SOURCE: "Listing not yet checked by an administrator",
  STALE_DATA: "Listing may be out of date",
};

/** Reasons that mean "we could not verify this", not "you match". */
const CAUTION_REASONS = new Set(["UNVERIFIED_SOURCE", "STALE_DATA"]);

const COMPONENT_LABELS: Record<string, string> = {
  NEED_FIT: "Financial need fit",
  COVERAGE_VALUE: "Coverage value",
  ACADEMIC_FIT: "Academic fit",
  FIELD_FIT: "Field fit",
  URGENCY: "Deadline urgency",
  EFFORT: "Application effort",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { index, current } = await resolveDemoStudent(await searchParams);
  if (!current) return <Empty>{NO_STUDENTS}</Empty>;

  const [view, wellbeing] = await Promise.all([
    getMatchView(current.email),
    getWellbeing(current.email),
  ]);
  if (!view) return <Empty>Student not found.</Empty>;

  const planning = await getPlanningView(
    current.email,
    view.need,
    wellbeing.latest?.dominantConcern ?? null,
  );

  const latest = wellbeing.latest;
  const dominant = latest?.dominantConcern as ConcernCategory | null | undefined;
  const remedies = dominant ? actionsFor(dominant) : [];
  const { personalisation, plan } = planning;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome, ${current.name.split(" ")[0]}`}
        description={`${view.student.studentProfile?.university} · ${view.student.studentProfile?.degree} · semester ${view.student.studentProfile?.currentSemester}`}
      />

      {latest?.crisisDetected && (
        <Callout
          tone="urgent"
          title="Your last entry suggests you may be in distress right now"
          action={
            <ButtonLink href={withStudent("/support", index)}>
              See support and crisis contacts →
            </ButtonLink>
          }
        >
          These services are free, confidential and available now. You do not need permission or a
          referral from anyone.
        </Callout>
      )}

      {/* ── 1. Where you stand ─────────────────────────────────────────── */}
      <Section
        title="1 · Where you stand"
        description="Three numbers, each explained where it comes from. None of them is a judgement."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <Stat
              label="Financial need score"
              value={view.need.score}
              unit="/100"
              href={withStudent("/financial", index)}
              note={
                <>
                  {view.need.bandLabel}
                  {view.need.provisional && (
                    <>
                      {" · "}
                      <span className="mm-badge mm-badge-dotted align-middle">
                        provisional
                      </span>
                    </>
                  )}
                </>
              }
            />
            <p className="mt-3 text-xs leading-relaxed text-zinc-600">{view.need.headline}</p>
          </Card>

          <Card>
            <Stat
              label="This month's balance"
              value={plan ? pkr(plan.monthlySurplus) : "—"}
              href={withStudent("/finances", index)}
              note={
                plan ? (
                  plan.position === "SURPLUS" ? (
                    <>
                      {pkr(plan.monthlyIncome)} in, {pkr(plan.monthlyExpenses)} out. Surplus.
                    </>
                  ) : (
                    <>
                      {pkr(plan.monthlyIncome)} in, {pkr(plan.monthlyExpenses)} out. Short by{" "}
                      {pkr(Math.abs(plan.monthlySurplus))} a month.
                    </>
                  )
                ) : (
                  <>Set up your monthly figures to get this.</>
                )
              }
            />
          </Card>

          <Card>
            <Stat
              label="Funding you can apply for"
              value={view.summary.eligibleCount}
              note={
                <>
                  from {view.summary.totalCandidates} public listings
                  {view.nearMisses.length > 0 && ` · ${view.nearMisses.length} close but not yet`}
                </>
              }
              href={withStudent("/opportunities", index)}
            />
          </Card>
        </div>
      </Section>

      {/* ── 2. Priorities ───────────────────────────────────────────────── */}
      <Section
        title="2 · What we are focusing on first"
        description="Ordered from your answers and your latest check-in. Tap any line to change it."
        action={
          <ButtonLink href={withStudent("/onboarding", index)} variant="outline">
            Change my answers
          </ButtonLink>
        }
      >
        {personalisation ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2">
              <ol className="space-y-2">
                {personalisation.priorities.map((priority, position) => (
                  <li key={priority.code} className="mm-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mm-eyebrow">
                          {position === 0 ? "First · " : `#${position + 1} · `}
                          {PRIORITY_LABELS[priority.code]}
                        </p>
                        <p className="mt-1 text-sm text-zinc-700">{priority.why}</p>
                      </div>
                      <div className="w-24 shrink-0">
                        <Bar value={priority.emphasis * 100} />
                        <p className="mm-num mt-1 text-right text-xs text-zinc-500">
                          {Math.round(priority.emphasis * 100)}%
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              {personalisation.studyPlan && (
                <Card title="Your week, as planned" description={personalisation.studyPlan.headline}>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
                    {personalisation.studyPlan.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {personalisation.weeklyBudget && (
                    <table className="mm-table mt-4">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th className="text-right">Hours / week</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ["Study", personalisation.weeklyBudget.study],
                            ["Rest, people, movement", personalisation.weeklyBudget.wellbeing],
                            ["Paid work", personalisation.weeklyBudget.work],
                            ["Travel", personalisation.weeklyBudget.commute],
                            ["Admin, forms, fees", personalisation.weeklyBudget.admin],
                          ] as const
                        ).map(([label, hours]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            <td className="mm-num text-right">{hours}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}
            </div>

            <Card title="Why you are seeing this order" description="Every answer that changed something">
              <ul className="space-y-2">
                {personalisation.influences.map((influence) => (
                  <li key={`${influence.answer}-${influence.effect}`} className="text-xs">
                    <span className="font-semibold text-zinc-900">{influence.answer}</span>
                    <span className="mx-1 text-zinc-400">→</span>
                    <span className="text-zinc-600">{influence.effect}</span>
                  </li>
                ))}
              </ul>
              {personalisation.supportRoute && (
                <div className="mm-rule mt-4 pt-3">
                  <p className="mm-eyebrow">How we will point you to help</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {personalisation.supportRoute.label}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">{personalisation.supportRoute.detail}</p>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Empty>
            You have not told us what matters most to you yet.{" "}
            <Link href={withStudent("/onboarding", index)} className="underline">
              Answer eight questions
            </Link>{" "}
            and the dashboard reorders itself around your answers.
          </Empty>
        )}
      </Section>

      {/* ── 3. Money ────────────────────────────────────────────────────── */}
      <Section
        title="3 · Your money"
        description="Your own figures, turned into a monthly position and a funding target."
        action={
          <ButtonLink href={withStudent("/finances", index)} variant="outline">
            Edit my figures
          </ButtonLink>
        }
      >
        {plan ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Where the money goes each month">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="In" value={pkr(plan.monthlyIncome)} />
                <Stat
                  label={plan.monthlySurplus >= 0 ? "Left over" : "Short by"}
                  value={pkr(Math.abs(plan.monthlySurplus))}
                />
              </div>
              <div className="mm-rule mt-4 pt-3">
                <dl className="space-y-1 text-xs text-zinc-600">
                  <div className="flex justify-between">
                    <dt>Essential costs (rent, food, travel, phone)</dt>
                    <dd className="mm-num">{pkr(plan.monthlyEssential)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Everything else</dt>
                    <dd className="mm-num">{pkr(plan.monthlyDiscretionary)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Emergency buffer target ({planning.plannerInput?.bufferTargetMonths} months)</dt>
                    <dd className="mm-num">{pkr(plan.emergencyBufferTarget)}</dd>
                  </div>
                </dl>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-600">{plan.headline}</p>
            </Card>

            <Card
              title="What each term looks like"
              description={plan.terms.length > 0 ? "Fees are usually payable before the term starts" : undefined}
            >
              <table className="mm-table">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th className="text-right">Fee due</th>
                    <th className="text-right">Short by then</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.terms.map((term) => (
                    <tr key={term.term}>
                      <td>{term.label}</td>
                      <td className="mm-num text-right">{pkr(term.feeDue)}</td>
                      <td className="mm-num text-right">
                        {term.coveredBySavings ? (
                          <Badge variant="outline">covered</Badge>
                        ) : (
                          pkr(term.runningGap)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-600">{plan.terms[0]?.advice}</p>
              {plan.annualFundingTarget > 0 && (
                <div className="mm-rule mt-4 pt-3">
                  <Stat
                    label="Annual funding target"
                    value={pkr(plan.annualFundingTarget)}
                    note="The shortfall plus a buffer, so a single bad month does not sink the plan. This is the figure matched against real awards."
                  />
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Empty>
            No monthly figures yet.{" "}
            <Link href={withStudent("/finances", index)} className="underline">
              Enter them once
            </Link>{" "}
            and the plan is calculated from them every time you open this page.
          </Empty>
        )}
      </Section>

      {/* ── 4. Wellbeing ────────────────────────────────────────────────── */}
      {latest && (
        <Section
          title="4 · How you have been doing"
          action={
            <ButtonLink href={withStudent("/checkin", index)} variant="outline">
              New check-in
            </ButtonLink>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <Stat
                label="Stress, latest check-in"
                value={latest.stressLevel}
                unit="/10"
                note={`${latest.day}${wellbeing.averageStress !== null ? ` · recent average ${wellbeing.averageStress}` : ""}`}
              />
              {dominant && (
                <p className="mt-3 text-sm text-zinc-700">
                  Top concern: <strong>{CATEGORY_LABELS[dominant]}</strong>
                </p>
              )}
            </Card>
            <Card title="What would actually help">
              {remedies.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  Nothing routed yet — a check-in will produce concrete next steps here.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {remedies.map((action) => (
                    <LinkRow key={action.target + action.remedy} href={withStudent(action.target, index)}>
                      {action.remedy}
                    </LinkRow>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </Section>
      )}

      {/* ── 5. Funding ──────────────────────────────────────────────────── */}
      <Section
        title="5 · Funding you can apply for"
        description={`Rule-based eligibility · engine v${view.summary.engineVersion}. Ranked, with every point attributable to a named factor.`}
        action={
          <ButtonLink href={withStudent("/opportunities", index)} variant="outline">
            All {view.summary.totalCandidates} listings
          </ButtonLink>
        }
      >
        {view.ranked.length === 0 ? (
          <Empty>
            Nothing is eligible for you right now. That is usually a profile gap rather than a
            real dead end — the near-misses list explains exactly what each one is waiting on.
          </Empty>
        ) : (
          <ol className="space-y-3">
            {view.ranked.slice(0, 4).map(({ row, result }, position) => (
              <li key={row.id} className="mm-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mm-eyebrow">
                      {position + 1} · {row.provider}
                    </p>
                    <Link
                      href={withStudent(`/opportunities/${row.slug}`, index)}
                      className="mt-0.5 block font-semibold text-zinc-900 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant={row.verificationStatus === "VERIFIED" ? "outline" : "dotted"}>
                        {row.verificationStatus === "VERIFIED" ? "✓ verified listing" : "⚠ unverified listing"}
                      </Badge>
                      {result.unverifiedCriteria.length > 0 && (
                        <Badge variant="dotted">
                          needs {result.unverifiedCriteria.join(", ").toLowerCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="mm-num text-2xl font-semibold">{result.score}%</p>
                    <p className="text-xs text-zinc-500">match score</p>
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {result.reasons.map((reason) => (
                    <li key={reason}>
                      <Badge variant={CAUTION_REASONS.has(reason) ? "dotted" : "muted"}>
                        {CAUTION_REASONS.has(reason) && <span aria-hidden>⚠ </span>}
                        {REASON_LABELS[reason] ?? reason}
                      </Badge>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 space-y-1">
                  {result.breakdown.map((component) => (
                    <div key={component.code} className="flex items-center gap-2 text-xs">
                      <span className="w-36 shrink-0 text-zinc-500">
                        {COMPONENT_LABELS[component.code] ?? component.code}
                      </span>
                      <Bar value={component.points} className="flex-1" />
                      <span className="mm-num w-16 shrink-0 text-right text-zinc-600">
                        {component.points} / {component.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* ── Honesty notes ───────────────────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Callout tone="caution" title="A deadline is only shown if it was confirmed">
          A date appears only when it was read from the official page. Where the current cycle
          date is unconfirmed we leave it blank rather than guess — a wrong deadline is worse than
          a missing one. Past deadlines stay visible so you can see what has already closed.
        </Callout>
        {view.summary.usedAssumptions && (
          <Callout tone="caution" title="Some results rest on assumed values">
            A listing was matched even though we could not check one of its requirements, because
            your profile is missing that detail. Those results are marked so you know which ones to
            confirm before applying.
          </Callout>
        )}
      </div>
    </>
  );
}