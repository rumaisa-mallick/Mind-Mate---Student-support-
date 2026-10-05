import Link from "next/link";
import { listSupportServices } from "@/server/services/matching.service";

const TYPE_LABELS: Record<string, string> = {
  CRISIS_HOTLINE: "Crisis line",
  ACADEMIC_ADVISOR: "Academic advisor",
  COUNSELOR: "Counsellor",
  FINANCIAL_AID: "Financial aid office",
  CAREER_CENTER: "Career centre",
};

export default async function SupportPage() {
  const services = await listSupportServices();
  const emergency = services.filter((service) => service.isEmergency);
  const others = services.filter((service) => !service.isEmergency);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="text-sm text-slate-600">
          MindMate does not replace counsellors, advisors or financial aid officers. This page
          exists to make them easier to find.
        </p>
      </header>

      <section className="rounded-lg border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-900">If you are in immediate danger</h2>
        <p className="mt-1 text-sm text-red-800">
          Contact your local emergency number. These lines are free and confidential.
        </p>

        <ul className="mt-4 space-y-2">
          {emergency.map((service) => (
            <li key={service.id} className="rounded border border-red-200 bg-white p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{service.name}</span>
                {service.phone && (
                  <a
                    href={`tel:${service.phone}`}
                    className="rounded bg-red-700 px-3 py-1 text-sm font-medium text-white"
                  >
                    Call {service.phone}
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-600">{service.org}</p>
              <p className="mt-1 text-xs text-amber-800">
                ⚠️ Unverified listing — {service.openingHours}. Confirm the number before
                publishing this app.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">University services</h2>
        {others.length === 0 ? (
          <p className="text-sm text-slate-600">No services listed yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {others.map((service) => (
              <li key={service.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <span className="text-xs text-slate-500">
                  {TYPE_LABELS[service.type] ?? service.type}
                </span>
                <p className="mt-0.5 font-medium">{service.name}</p>
                <p className="text-xs text-slate-600">{service.org}</p>
                <p className="mt-2 text-xs text-slate-500">{service.openingHours}</p>
                <p className="mt-1 text-xs text-amber-700">
                  Placeholder entry — replace with your university&apos;s real contact details.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-medium">What MindMate will never do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Diagnose you, or tell you what condition you have</li>
          <li>Show your journal text or financial profile to any administrator</li>
          <li>Call you poor, or rank students against each other by income</li>
          <li>Invent a scholarship, a requirement, or a deadline</li>
        </ul>
        <Link href="/financial" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          See how your financial profile is scored →
        </Link>
      </section>
    </div>
  );
}
