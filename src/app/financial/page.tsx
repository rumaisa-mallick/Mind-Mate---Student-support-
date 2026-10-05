import { NO_STUDENTS, resolveDemoStudent, withStudent } from "@/server/services/demo";
import { getMatchView } from "@/server/services/matching.service";
import { PK_INCOME_BANDS_MONTHLY, PK_WEIGHT_SET_V1 } from "@/config/pakistan";
import { Badge, Bar, ButtonLink, Callout, Card, Empty, PageHeader, Section, Stat } from "@/components/ui";

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
  const { index, current } = await resolveDemoStudent(await searchParams);
  if (!current) return <Empty>{NO_STUDENTS}</Empty>;

  const view = await getMatchView(current.email);
  if (!view) return <Empty>Student not found.</Empty>;

  const { need } = view;
  const totalPoints = need.contributions.reduce((sum, c) => sum + c.points, 0);

  return (
    <>
      <PageHeader
        eyebrow="Need score"
        title="Your financial need score"
        description={`${current.name} · every point below is attributable to a named factor. This is an estimate for prioritising support, not a verdict about you, and never a label.`}
      />

      <Section title="1 · The score">
        <Card>
          <div className="grid gap-6 lg:grid-cols-4">
            <Stat label="Score" value={need.score} unit="/100" note={need.bandLabel} />
            <div className="lg:col-span-2">
              <p className="mm-eyebrow">Band</p>
              <div className="mt-2 flex items-center gap-3">
                <Badge variant={need.provisional ? "dotted" : "solid"}>
                  {need.bandLabel}
                  {need.provisional && " · provisional"}
                </Badge>
                <span className="text-xs text-zinc-500">
                  weight set v{need.weightSetVersion}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-700">{need.headline}</p>
              <div className="mt-3">
                <Bar value={need.score} hatched={need.provisional} />
                <p className="mm-num mt-1 text-xs text-zinc-500">
                  {Math.round(need.inputCoverage * 100)}% of the weighting is backed by data you
                  supplied
                </p>
              </div>
            </div>
            <div className="text-xs leading-relaxed text-zinc-600">
              <p className="mm-eyebrow">How to read the bar</p>
              <p className="mt-1">
                Solid means every factor was measured. A hatched bar means some inputs were
                missing and the remaining weights were renormalised — treat the number as a rough
                starting point, not a decision.
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section
        title="2 · Every factor, with its contribution"
        description="Points sum to the score. Nothing is hidden behind a total."
      >
        <Card>
          <table className="mm-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th className="text-right">Weight</th>
                <th className="w-40">Strength</th>
                <th className="text-right">Points</th>
                <th>What it measures</th>
              </tr>
            </thead>
            <tbody>
              {need.contributions.map((contribution) => (
                <tr key={contribution.code}>
                  <td className="font-medium">{contribution.label}</td>
                  <td className="mm-num text-right text-zinc-500">{contribution.weight}</td>
                  <td>
                    <Bar value={contribution.normalised * 100} />
                  </td>
                  <td className="mm-num text-right">
                    {contribution.points}
                    <span className="text-xs text-zinc-400"> pts</span>
                  </td>
                  <td className="max-w-xs text-xs text-zinc-600">
                    {FACTOR_EXPLAINERS[contribution.code]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mm-rule mt-4 pt-3 text-xs text-zinc-500">
            Points sum to {totalPoints.toFixed(1)} of a 100-point score.
          </p>
        </Card>

        {need.missing.length > 0 && (
          <Callout tone="caution" title="Some of this is estimated">
            Missing{" "}
            {need.missing.join(", ").toLowerCase().replaceAll("_", " ")} — rather than guessing,
            the remaining weights are renormalised. Adding these details makes the score more
            accurate without ever requiring you to upload proof.
          </Callout>
        )}
      </Section>

      <Section title="3 · What this is used for, and what it is not">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Used for">
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>✓ Matching need-based awards, where the programme publishes a need threshold</li>
              <li>✓ Deciding which funding route to put first on your dashboard</li>
              <li>✓ Prioritising a conversation with your university&apos;s financial aid office</li>
            </ul>
            <div className="mt-3">
              <ButtonLink href={withStudent("/opportunities", index)}>See matched opportunities</ButtonLink>
            </div>
          </Card>
          <Card title="Never used for">
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>✕ Ranking students against each other</li>
              <li>✕ Deciding an application&apos;s outcome — that is the awarding body&apos;s job</li>
              <li>✕ Being shown to any administrator, in whole or in part</li>
              <li>✕ Any label about how well-off you are</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section title="4 · The published scale (Pakistan)">
        <Card description="These anchors are public and versioned. Change them and every score changes with them — that is why the version is stored next to each score.">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Band</th>
                <th>Monthly household income</th>
              </tr>
            </thead>
            <tbody>
              {PK_INCOME_BANDS_MONTHLY.map((band) => (
                <tr key={band.code}>
                  <td className="mm-num text-xs text-zinc-500">{band.code}</td>
                  <td>{band.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs leading-relaxed text-zinc-600">
            Anchors: the need factor is 1.0 at or below{" "}
            {PK_WEIGHT_SET_V1.anchors.incomeLowAnchor.toLocaleString()} PKR per month, and 0.0 at or
            above {PK_WEIGHT_SET_V1.anchors.incomeHighAnchor.toLocaleString()} PKR per month. Bands:
            under {PK_WEIGHT_SET_V1.bands.low} is low, under {PK_WEIGHT_SET_V1.bands.moderate} is
            moderate, under {PK_WEIGHT_SET_V1.bands.high} is high, and anything above that is very
            high.
          </p>
        </Card>
      </Section>
    </>
  );
}