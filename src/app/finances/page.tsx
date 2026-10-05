import { NO_STUDENTS, resolveDemoStudent, withStudent } from "@/server/services/demo";
import { getMatchView } from "@/server/services/matching.service";
import { getPlanningView } from "@/server/services/planning.service";
import { defaultExpenses } from "@/domain/finance/planner";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  Empty,
  PageHeader,
  Section,
  Stat,
  pkr,
} from "@/components/ui";
import { BudgetForm } from "./form";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { index, current } = await resolveDemoStudent(await searchParams);
  if (!current) return <Empty>{NO_STUDENTS}</Empty>;

  const view = await getMatchView(current.email);
  if (!view) return <Empty>Student not found.</Empty>;

  const planning = await getPlanningView(
    current.email,
    view.need,
    null,
  );
  const { plan, plannerInput } = planning;

  // A student with no plan yet gets the scaffold so the form is usable
  // immediately rather than an empty box.
  const income = plannerInput?.incomeSources ?? [
    { label: "Family support", monthly: 0, stable: true },
    { label: "Part-time work", monthly: 0, stable: false },
  ];
  const expenses = (plannerInput?.expenses ?? defaultExpenses()).slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="My plan"
        title="What comes in, what goes out, what is left"
        description="Your own numbers, turned into a position you can act on. Nothing here is advice from a stranger about your life — it is arithmetic on the figures you give it."
      />

      {/* ── The position ─────────────────────────────────────────────────── */}
      <Section title="1 · Where you stand this month">
        {plan ? (
          <>
            <div className="grid gap-4 lg:grid-cols-4">
              <Card>
                <Stat label="Comes in" value={pkr(plan.monthlyIncome)} note="All sources, per month" />
              </Card>
              <Card>
                <Stat
                  label="Goes out"
                  value={pkr(plan.monthlyExpenses)}
                  note={`${pkr(plan.monthlyEssential)} essential, ${pkr(plan.monthlyDiscretionary)} optional`}
                />
              </Card>
              <Card>
                <Stat
                  label={plan.monthlySurplus >= 0 ? "Left over" : "Short by"}
                  value={pkr(Math.abs(plan.monthlySurplus))}
                  note={
                    plan.monthlySurplus >= 0
                      ? "A positive monthly balance"
                      : `${pkr(Math.abs(plan.monthlySurplus))} × 12 = ${pkr(Math.abs(plan.annualSurplus))} a year`
                  }
                />
              </Card>
              <Card>
                <Stat
                  label="Emergency buffer target"
                  value={pkr(plan.emergencyBufferTarget)}
                  note={`Essential costs × ${plannerInput?.bufferTargetMonths ?? 3} months`}
                />
              </Card>
            </div>

            <div className="mt-4">
              <Callout
                tone={plan.position === "SURPLUS" ? "note" : "caution"}
                title={plan.position === "SURPLUS" ? "You are in a positive monthly position" : "You are short each month"}
              >
                {plan.headline}
              </Callout>
            </div>
          </>
        ) : (
          <Empty>
            Enter your figures below and the plan is built from them. The numbers are yours alone.
          </Empty>
        )}
      </Section>

      {/* ── Term plan ───────────────────────────────────────────────────── */}
      {plan && (
        <Section
          title="2 · Each fee instalment, term by term"
          description="Fees usually fall due before a term starts, so the money has to exist beforehand — this view assumes it does not."
        >
          <Card>
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th className="text-right">Fee due</th>
                  <th className="text-right">Saved by then</th>
                  <th className="text-right">Short by then</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                {plan.terms.map((term) => (
                  <tr key={term.term}>
                    <td className="font-medium">{term.label}</td>
                    <td className="mm-num text-right">{pkr(term.feeDue)}</td>
                    <td className="mm-num text-right">
                      {term.coveredBySavings ? "—" : pkr(term.feeDue - term.runningGap)}
                    </td>
                    <td className="mm-num text-right">
                      {term.coveredBySavings ? (
                        <Badge variant="outline">✓ covered</Badge>
                      ) : (
                        pkr(term.runningGap)
                      )}
                    </td>
                    <td className="max-w-xs text-xs text-zinc-600">{term.advice}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {plan.annualFundingTarget > 0 && (
              <div className="mm-rule mt-4 grid gap-4 pt-4 sm:grid-cols-2">
                <Stat
                  label="Annual funding target"
                  value={pkr(plan.annualFundingTarget)}
                  note="Shortfall plus the buffer you have not saved yet. This is the figure matched against real awards — not a guess."
                />
                <div className="text-xs leading-relaxed text-zinc-600">
                  <p>
                    <strong className="text-zinc-900">
                      Closing only the shortfall would still leave you exposed.
                    </strong>{" "}
                    The first bad month is what turns a tight plan into a crisis, so the buffer is
                    counted as part of the target.
                  </p>
                  <p className="mt-2">
                    <ButtonLink href={withStudent("/opportunities", index)} variant="outline">
                      Find awards against this figure →
                    </ButtonLink>
                  </p>
                </div>
              </div>
            )}
          </Card>
        </Section>
      )}

      {/* ── Levers ──────────────────────────────────────────────────────── */}
      {plan && plan.levers.length > 0 && (
        <Section
          title="3 · What you could change, and by how much"
          description="Ranked by real monthly rupees. Everything here is optional, including the spending rows — this plan will not tell you what to give up."
        >
          <Card>
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th className="text-right">Worth per month</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {plan.levers.map((lever) => (
                  <tr key={lever.code}>
                    <td className="font-medium">
                      {lever.label}
                      {lever.discretionary && (
                        <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          your call
                        </span>
                      )}
                    </td>
                    <td className="mm-num text-right">
                      {lever.monthlyImpact > 0 ? pkr(lever.monthlyImpact) : "—"}
                    </td>
                    <td className="max-w-sm text-xs text-zinc-600">{lever.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mm-rule mt-4 pt-3 text-xs text-zinc-600">
              {plan.position === "SURPLUS" ? (
                <>
                  Your costs are covered, so there is no gap for any of this to close. It is listed so
                  you can see the numbers if your circumstances change.
                </>
              ) : (
                <>
                  If every option were applied — they cannot all be at once, and several would cost
                  you something — the plan would move by {pkr(plan.maxMonthlyLeverImpact)} a month
                  {plan.leversCloseGap
                    ? ", which would cover the gap."
                    : ", which is still short of covering it. That is why the funding target above is not optional."}
                </>
              )}
            </p>
          </Card>
        </Section>
      )}

      {/* ── Assumptions ─────────────────────────────────────────────────── */}
      {plan && plan.assumptions.length > 0 && (
        <Section title="4 · Assumptions this plan makes">
          <Card>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {plan.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              If any of these are wrong for you, fix the figure at the bottom and the plan
              recalculates.
            </p>
          </Card>
        </Section>
      )}

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      <Section
        title="5 · Your figures"
        description="Enter them once. They are stored so the plan can be rebuilt, and are visible to nobody else."
      >
        <BudgetForm
          email={current.email}
          income={income}
          expenses={expenses}
          annualTuition={plannerInput?.annualTuition ?? view.student.financialProfile?.tuitionAnnual ?? 0}
          termsPerYear={plannerInput?.termsPerYear ?? 2}
          bufferTargetMonths={plannerInput?.bufferTargetMonths ?? 3}
          hasPlan={plan !== null}
        />
      </Section>
    </>
  );
}