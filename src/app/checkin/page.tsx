import { NO_STUDENTS, resolveDemoStudent, withStudent } from "@/server/services/demo";
import { getWellbeing } from "@/server/services/matching.service";
import {
  actionsFor,
  CATEGORY_LABELS,
  CONCERN_CATEGORIES,
  type ConcernCategory,
} from "@/domain/wellbeing/classifier";
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
} from "@/components/ui";
import { createCheckin } from "./actions";

/**
 * Moods are labelled in words, not emoji. Emoji-only options read as a game,
 * and several students here will be describing distress — the label is the
 * thing they are actually choosing, so the label is what has to be honest.
 */
const MOODS = [
  { code: "GOOD", label: "Good" },
  { code: "OK", label: "Okay" },
  { code: "NEUTRAL", label: "Neutral" },
  { code: "STRESSED", label: "Stressed" },
  { code: "VERY_STRESSED", label: "Very stressed" },
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
  HOUSING: "Where I live",
  TRANSPORT: "Getting to campus",
  OTHER: "Something else",
};

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { index, current } = await resolveDemoStudent(await searchParams);
  if (!current) return <Empty>{NO_STUDENTS}</Empty>;

  const wellbeing = await getWellbeing(current.email);
  const latest = wellbeing.latest;
  const dominant = latest?.dominantConcern as ConcernCategory | null | undefined;

  return (
    <>
      <PageHeader
        eyebrow="Check-in"
        title="How is today?"
        description={`${current.name} · this sorts your situation into themes so the right next steps appear. It does not diagnose anything, and nothing here is shared with staff.`}
      />

      {latest?.crisisDetected && (
        <Callout
          tone="urgent"
          title="Please talk to someone today"
          action={
            <ButtonLink href={withStudent("/support", index)}>See crisis contacts now</ButtonLink>
          }
        >
          Your last note suggests you may be in distress. These services are free and confidential.
          You do not need a referral, and you do not need to explain yourself first.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Form ────────────────────────────────────────────────────── */}
        <Section title="1 · Today's entry" >
          <Card>
            <form action={createCheckin} className="space-y-5">
              <input type="hidden" name="email" value={current.email} />

              <fieldset>
                <legend className="text-sm font-medium text-zinc-900">
                  How are you feeling today?
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MOODS.map((mood, position) => (
                    <label key={mood.code} className="mm-choice">
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
              </fieldset>

              <div>
                <label htmlFor="stressLevel" className="text-sm font-medium text-zinc-900">
                  Stress level: <span className="mm-num">5</span> / 10
                </label>
                <input
                  id="stressLevel"
                  name="stressLevel"
                  type="range"
                  min={1}
                  max={10}
                  defaultValue={5}
                  className="mt-2 w-full"
                />
                <p className="text-xs text-zinc-500">1 is calm, 10 is as bad as it gets today.</p>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-zinc-900">
                  What is affecting you?
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(FACTOR_LABELS).map(([code, label]) => (
                    <label key={code} className="mm-choice">
                      <input type="checkbox" name="tags" value={code} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Ticking a box takes priority over the text — use it if what you feel does not fit
                  the words below.
                </p>
              </fieldset>

              <div>
                <label htmlFor="note" className="text-sm font-medium text-zinc-900">
                  Anything you want to add? (optional)
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={4}
                  maxLength={2000}
                  className="mm-input mt-2"
                  placeholder="e.g. My semester fees are due and I am not sure how I will manage."
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Stored privately. Never shown to staff or administrators, and never used to
                  decide a funding match.
                </p>
              </div>

              <button type="submit" className="mm-btn w-full">
                Save check-in
              </button>
            </form>
          </Card>
        </Section>

        {/* ── Results ─────────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-3">
          {latest && (
            <Section title="2 · What came back">
              <Card>
                <div className="grid gap-6 sm:grid-cols-3">
                  <Stat label="Stress" value={latest.stressLevel} unit="/10" note={latest.day} />
                  <Stat
                    label="Top concern"
                    value={dominant ? CATEGORY_LABELS[dominant] : "—"}
                    note={
                      latest.confidence !== null
                        ? `${Math.round(latest.confidence * 100)}% of the evidence pointed here`
                        : undefined
                    }
                  />
                  <Stat
                    label="Recent average"
                    value={wellbeing.averageStress ?? "—"}
                    unit={wellbeing.averageStress !== null ? "/10" : undefined}
                    note="Across your recent check-ins"
                  />
                </div>

                {latest.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {latest.tags.map((tag) => (
                      <Badge key={tag} variant="muted">
                        {FACTOR_LABELS[tag] ?? tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {latest.scores && (
                  <div className="mm-rule mt-4 space-y-1 pt-3">
                    <p className="mm-eyebrow">Every theme scored, including the low ones</p>
                    {CONCERN_CATEGORIES.filter((c) => (latest.scores?.[c] ?? 0) > 0).map((category) => (
                      <div key={category} className="flex items-center gap-2 text-xs">
                        <span className="w-28 shrink-0 text-zinc-500">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <Bar value={(latest.scores?.[category] ?? 0) * 20} className="flex-1" />
                        <span className="mm-num w-10 shrink-0 text-right text-zinc-500">
                          {(latest.scores?.[category] ?? 0).toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Section>
          )}

          {dominant && (
            <Section
              title={`3 · What would actually help with ${CATEGORY_LABELS[dominant].toLowerCase()}`}
              description="Routed from the concern, not chosen by hand."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {actionsFor(dominant).map((action) => (
                  <LinkRow
                    key={action.target + action.remedy}
                    href={withStudent(action.target, index)}
                  >
                    {action.remedy}
                  </LinkRow>
                ))}
              </div>
            </Section>
          )}

          {wellbeing.history.length > 0 && (
            <Section title="4 · Your trend" description={`${wellbeing.history.length} recent check-ins.`}>
              <Card>
                <div className="flex items-end gap-1">
                  {wellbeing.history.map((entry) => (
                    <div key={entry.day} className="flex flex-1 flex-col items-center gap-1">
                      <span className="mm-num text-xs text-zinc-500">{entry.stressLevel}</span>
                      <span
                        className="w-full rounded-t-sm bg-zinc-900"
                        style={{ height: `${entry.stressLevel * 8}px` }}
                      />
                      <span className="text-[10px] text-zinc-500">{entry.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <p className="mm-rule mt-4 pt-3 text-xs leading-relaxed text-zinc-600">
                  A trend is useful; a single day is not. If this chart has been high for weeks,
                  that is worth taking to a person — see{" "}
                  <a href={withStudent("/support", index)} className="underline">
                    support
                  </a>
                  .
                </p>
              </Card>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}