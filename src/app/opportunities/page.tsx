import Link from "next/link";
import { NO_STUDENTS, resolveDemoStudent, withStudent } from "@/server/services/demo";
import { getMatchView, listOpportunities } from "@/server/services/matching.service";
import { DeadlineBadge } from "@/components/deadline";
import { Badge, Callout, Card, Empty, PageHeader, Section } from "@/components/ui";

const TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "Scholarship",
  INTERNSHIP: "Internship",
  COMPETITION: "Competition",
  COURSE: "Course",
  FELLOWSHIP: "Fellowship",
  EXCHANGE: "Exchange",
};

/** Categories are internal codes; show a readable label or nothing at all. */
const CATEGORY_LABELS: Record<string, string> = {
  NEED_BASED: "need-based",
  MERIT_BASED: "merit-based",
  FULLY_FUNDED: "fully funded",
  DOMESTIC: "in Pakistan",
  DEVELOPING_COUNTRIES: "developing countries",
  HEC_NOMINATED: "HEC nominated",
  WOMEN_ONLY: "for women",
  POSTGRADUATE_RESEARCH: "postgraduate research",
  SHORT_TERM: "short-term",
  ENTREPRENEURSHIP: "entrepreneurship",
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

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; type?: string }>;
}) {
  const params = await searchParams;
  const { index, current } = await resolveDemoStudent(params);

  const [all, view] = await Promise.all([
    listOpportunities(),
    current ? getMatchView(current.email) : Promise.resolve(null),
  ]);

  const filtered = params.type ? all.filter((o) => o.type === params.type) : all;
  const scoreById = new Map(view?.summary.results.map((r) => [r.opportunityId, r]) ?? []);

  const verified = all.filter((row) => row.verificationStatus === "VERIFIED").length;

  return (
    <>
      <PageHeader
        eyebrow="Funding"
        title="Opportunities"
        description={`${all.length} listings for students in Pakistan, matched against ${current?.name ?? "—"} by published rules. ${verified} verified against an official source; the rest are indicative and labelled as such.`}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={withStudent("/opportunities", index)}
            className={`mm-badge ${
              params.type ? "mm-badge-outline" : "mm-badge-solid"
            }`}
          >
            All ({all.length})
          </Link>
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const count = all.filter((o) => o.type === type).length;
            if (count === 0) return null;
            const active = params.type === type;
            return (
              <Link
                key={type}
                href={`/opportunities?s=${index}&type=${type}`}
                className={`mm-badge ${active ? "mm-badge-solid" : "mm-badge-outline"}`}
              >
                {label} ({count})
              </Link>
            );
          })}
        </div>
      </PageHeader>

      {filtered.length === 0 ? (
        <Empty>No listings of this type yet.</Empty>
      ) : (
        <Section title="Listings">
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
            {filtered.map((row) => {
              const result = scoreById.get(row.id);
              const categories = parseList(row.categories);
              const verifiedRow = row.verificationStatus === "VERIFIED";

              return (
                <li key={row.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{TYPE_LABELS[row.type] ?? row.type}</Badge>
                        {categories.map((category) => (
                          <Badge key={category} variant="muted">
                            {CATEGORY_LABELS[category] ?? category.toLowerCase().replaceAll("_", " ")}
                          </Badge>
                        ))}
                        {row.countryCode && <span className="text-xs text-zinc-500">{row.countryCode}</span>}
                      </div>

                      <Link
                        href={withStudent(`/opportunities/${row.slug}`, index)}
                        className="mt-1.5 block font-semibold text-zinc-900 hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="text-xs text-zinc-500">{row.provider}</p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={verifiedRow ? "outline" : "dotted"}>
                          {verifiedRow ? "✓ verified" : "⚠ unverified listing"}
                        </Badge>
                        <DeadlineBadge deadline={row.deadline} />
                      </div>

                      {result && !result.eligible && (
                        <ul className="mt-2 space-y-0.5">
                          {result.disqualifiers.map((disqualifier) => (
                            <li key={disqualifier.code} className="text-xs text-zinc-600">
                              <span aria-hidden>✕ </span>
                              <span className="font-medium text-zinc-800">{disqualifier.label}:</span>{" "}
                              {disqualifier.humanText}
                            </li>
                          ))}
                        </ul>
                      )}
                      {result?.eligible && result.unverifiedCriteria.length > 0 && (
                        <p className="mt-2 text-xs text-zinc-600">
                          <span aria-hidden>⚠ </span>
                          Assumed eligible because we are missing{" "}
                          {result.unverifiedCriteria.join(", ").toLowerCase().replaceAll("_", " ")}.
                          Add those details to confirm.
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {result?.eligible ? (
                        <>
                          <p className="mm-num text-2xl font-semibold">{result.score}%</p>
                          <p className="text-xs text-zinc-500">eligible match</p>
                        </>
                      ) : result ? (
                        <Badge variant={result.nearMiss ? "dotted" : "outline"}>
                          {result.nearMiss ? "close — not yet" : "✕ not eligible"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Callout tone="caution" title="How to read a deadline here">
          A date is only ever shown when it was read from the awarding body&apos;s own page. Where
          the current cycle date is unconfirmed, the date is left blank — a missing deadline is a
          smaller mistake than an invented one. Deadlines that have already passed are kept so you
          can see what has closed.
        </Callout>
        <Card title="Verified versus indicative">
          <p className="text-xs leading-relaxed text-zinc-600">
            A <strong className="text-zinc-900">verified</strong> listing has its criteria and
            deadline checked against the official page, with the date that check happened. An{" "}
            <strong className="text-zinc-900">indicative</strong> listing is here so the option is
            visible before you find it yourself — but nobody has confirmed its current cycle yet,
            so check it yourself before spending an evening on it.
          </p>
        </Card>
      </div>
    </>
  );
}