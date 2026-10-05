import { listSupportServices } from "@/server/services/matching.service";
import { resolveDemoStudent, withStudent } from "@/server/services/demo";
import { Badge, ButtonLink, Callout, Card, Empty, PageHeader, Section } from "@/components/ui";

const TYPE_LABELS: Record<string, string> = {
  CRISIS_HOTLINE: "Crisis line",
  ACADEMIC_ADVISOR: "Academic advisor",
  COUNSELOR: "Counsellor",
  FINANCIAL_AID: "Financial aid office",
  CAREER_CENTER: "Career centre",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  // Support must work with no student selected, so the index is optional here.
  const { index } = await resolveDemoStudent(await searchParams);
  const services = await listSupportServices();
  const emergency = services.filter((service) => service.isEmergency);
  const others = services.filter((service) => !service.isEmergency);

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="People who can actually help"
        description="MindMate does not replace counsellors, advisors or financial aid officers. This page exists to make them easier to find, and to be honest about which numbers we have confirmed."
      />

      <Section title="1 · If you are in immediate danger">
        <div className="rounded-md border-2 border-zinc-900 p-5">
          <p className="text-sm font-semibold text-zinc-900">
            Contact your local emergency number. These lines are free and confidential.
          </p>
          <ul className="mt-4 space-y-2">
            {emergency.map((service) => (
              <li key={service.id} className="mm-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-zinc-900">{service.name}</span>
                  {service.phone && (
                    <a href={`tel:${service.phone}`} className="mm-btn">
                      Call {service.phone}
                    </a>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-600">{service.org}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                  <Badge variant="muted">{service.openingHours}</Badge>
                  <span className="flex flex-wrap gap-1">
                    {JSON.parse(service.languages || "[]").map((language: string) => (
                      <Badge key={language} variant="outline">
                        {language}
                      </Badge>
                    ))}
                  </span>
                </p>
                <p className="mt-2 text-xs text-zinc-600">
                  <span aria-hidden>⚠ </span>
                  Unverified listing. Confirm the number before relying on it.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        title="2 · University services"
        description="These are the offices that can act on a financial or academic problem today."
      >
        {others.length === 0 ? (
          <Empty>No services listed yet.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {others.map((service) => (
              <li key={service.id} className="mm-card p-4">
                <Badge variant="muted">{TYPE_LABELS[service.type] ?? service.type}</Badge>
                <p className="mt-1.5 font-semibold text-zinc-900">{service.name}</p>
                <p className="text-xs text-zinc-600">{service.org}</p>
                <p className="mt-2 text-xs text-zinc-500">{service.openingHours}</p>
                {service.phone && (
                  <a href={`tel:${service.phone}`} className="mt-2 inline-block text-sm underline">
                    {service.phone}
                  </a>
                )}
                <p className="mt-2 text-xs text-zinc-600">
                  <span aria-hidden>⚠ </span>
                  Placeholder entry — replace with your university&apos;s real contact details.
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="3 · What MindMate will never do">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Hard limits in the product">
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>✕ Diagnose you, or tell you what condition you have</li>
              <li>✕ Show your journal text or financial profile to any administrator</li>
              <li>✕ Call you poor, or rank students against each other by income</li>
              <li>✕ Invent a scholarship, a requirement, or a deadline</li>
              <li>✕ Ask for financial documents in order to register</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href={withStudent("/financial", index)} variant="outline">
                How your need score is calculated →
              </ButtonLink>
              <ButtonLink href={withStudent("/checkin", index)} variant="outline">
                What a check-in does →
              </ButtonLink>
            </div>
          </Card>
          <Callout tone="caution" title="Why the contacts above are marked unverified">
            <p>
              A wrong emergency number is worse than no number. Every service on this page is
              seeded as unverified on purpose — a human has to confirm each one against the real
              provider before this app is given to students.
            </p>
            <p className="mt-2">
              The university entries are generic placeholders. A real university partner would
              replace them with that institution&apos;s actual offices, phone numbers and opening
              hours.
            </p>
          </Callout>
        </div>
      </Section>
    </>
  );
}

