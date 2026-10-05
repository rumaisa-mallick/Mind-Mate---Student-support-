import { NO_STUDENTS, resolveDemoStudent } from "@/server/services/demo";
import { getPlanningView } from "@/server/services/planning.service";
import { computeFinancialNeed } from "@/domain/financial/score";
import { PK_INCOME_BANDS_MONTHLY, PK_WEIGHT_SET_V1 } from "@/config/pakistan";
import { formatDeadlineDay } from "@/domain/shared/dates";
import { prisma } from "@/server/db/client";
import { OnboardingForm } from "./form";
import { Callout, Card, PageHeader, Section, Stat } from "@/components/ui";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { current } = await resolveDemoStudent(await searchParams);
  if (!current) return <p className="text-zinc-600">{NO_STUDENTS}</p>;

  const user = await prisma.user.findUnique({
    where: { email: current.email },
    include: { personalisationProfile: true, financialProfile: true },
  });

  // The planning view needs the need score. It is a pure function of the
  // financial profile, so it is recomputed rather than read from the row — one
  // code path means this page and the dashboard can never disagree.
  const financial = user?.financialProfile ?? null;
  const need = computeFinancialNeed(
    {
      incomeBandCode: financial?.incomeBandCode ?? null,
      earners: financial?.earners ?? null,
      dependents: financial?.dependents ?? null,
      annualTuition: financial?.tuitionAnnual ?? null,
      accommodationStatus: (financial?.accommodationStatus ?? null) as never,
      annualAccommodationCost: financial?.accommodationAnnual ?? null,
      existingAidCoverage: (financial?.existingAidCoverage ?? null) as never,
    },
    { weightSet: PK_WEIGHT_SET_V1, incomeBands: PK_INCOME_BANDS_MONTHLY },
  );

  const planning = await getPlanningView(current.email, need, null);

  const profile = user?.personalisationProfile ?? null;

  const defaults = {
    primaryGoal: profile?.primaryGoal ?? null,
    secondaryGoals: parse(profile?.secondaryGoals),
    stressTriggers: parse(profile?.stressTriggers),
    supportPreference: profile?.supportPreference ?? null,
    availableHoursPerWeek: profile?.availableHoursPerWeek ?? null,
    studyStyle: profile?.studyStyle ?? null,
    commuteMinutes: profile?.commuteMinutes ?? null,
    workCommitment: profile?.workCommitment ?? null,
    caresForOthers: profile?.caresForOthers ?? false,
    tonePreference: profile?.tonePreference ?? null,
    preferredLanguage: profile?.preferredLanguage ?? "en",
  };

  return (
    <>
      <PageHeader
        eyebrow="My answers"
        title="Tell us what matters to you"
        description="Five short steps. This changes what you see first, how much detail you get, and how the app talks to you — nothing else. No documents are required, and no answer here can change whether you qualify for a scholarship."
      />

      {profile?.completedAt && (
        <Callout tone="note" title="You have already set these answers">
          Last saved {formatDeadlineDay(profile.completedAt)}. Change anything below and
          save when you are done.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <OnboardingForm email={current.email} defaults={defaults} />
        </div>

        <aside className="space-y-4">
          <Card title="What these answers do">
            <ul className="space-y-2 text-xs leading-relaxed text-zinc-600">
              <li>
                <strong className="text-zinc-900">They reorder.</strong> Your lead priority is
                shown first, and funding is pushed above it if your measured financial need says
                so — even if you picked something else.
              </li>
              <li>
                <strong className="text-zinc-900">They set your week.</strong> Work, travel and
                caring are subtracted before any study time is allocated.
              </li>
              <li>
                <strong className="text-zinc-900">They set the tone.</strong> Word choice and how
                much reasoning is shown.
              </li>
            </ul>
          </Card>

          <Card title="What they never do">
            <ul className="space-y-2 text-xs leading-relaxed text-zinc-600">
              <li>✕ Change whether you qualify for an award.</li>
              <li>✕ Share anything with an administrator.</li>
              <li>✕ Produce a clinical judgement about you.</li>
            </ul>
          </Card>

          {planning.personalisation && (
            <Card title="Your current plan" description="Recalculated from the answers above">
              <Stat
                label="Lead priority"
                value={
                  planning.personalisation.priorities[0]?.label.split(" ")[0] ?? "—"
                }
                note={planning.personalisation.priorities[0]?.why}
              />
              {planning.personalisation.weeklyBudget && (
                <div className="mm-rule mt-4 pt-3 text-xs text-zinc-600">
                  {planning.personalisation.weeklyBudget.totalHours}h a week allocated across{" "}
                  {planning.personalisation.weeklyBudget.study}h study and{" "}
                  {planning.personalisation.weeklyBudget.wellbeing}h rest.
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function parse(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}