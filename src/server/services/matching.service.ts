/**
 * Matching service — the seam between the database and the pure domain engine.
 *
 * Reads rows, maps them into the plain data structures `src/domain` expects,
 * runs the engine, and returns view models. No matching logic lives here.
 */

import { prisma } from "@/server/db/client";
import {
  matchOpportunities,
  type Criterion,
  type MatchSummary,
  type OpportunityForMatching,
  type StudentMatchInput,
} from "@/domain/matching/engine";
import { computeFinancialNeed, type FinancialNeedResult } from "@/domain/financial/score";
import {
  PK_INCOME_BANDS_MONTHLY,
  PK_MATCH_POLICY,
  PK_WEIGHT_SET_V1,
} from "@/config/pakistan";

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toDateOnly = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

export interface DemoStudentRef {
  email: string;
  name: string;
  needScore: number | null;
  needBand: string | null;
}

export async function listDemoStudents(): Promise<DemoStudentRef[]> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { email: "asc" },
    include: { financialProfile: true },
  });
  return students.map((student) => ({
    email: student.email,
    name: student.name,
    needScore: student.financialProfile?.needScore ?? null,
    needBand: student.financialProfile?.needBand ?? null,
  }));
}

interface StudentRow {
  id: string;
  email: string;
  name: string;
  studentProfile: {
    ageAtSignup: number | null;
    university: string | null;
    degree: string | null;
    degreeLevel: string | null;
    field: string | null;
    currentSemester: number | null;
    enrollmentStatus: string | null;
    documentsOnHand: string | null;
    profileComplete: boolean;
  } | null;
  academicProfile: { cgpa: number | null; cgpaScale: number | null } | null;
  financialProfile: {
    incomeBandCode: string | null;
    earners: number | null;
    dependents: number | null;
    tuitionAnnual: number | null;
    accommodationStatus: string | null;
    accommodationAnnual: number | null;
    existingAidCoverage: string | null;
    assistanceRequired: boolean;
    needScore: number | null;
    needBand: string | null;
  } | null;
}

const studentInclude = {
  studentProfile: true,
  academicProfile: true,
  financialProfile: true,
} as const;

async function loadStudent(email: string): Promise<StudentRow | null> {
  return prisma.user.findUnique({ where: { email }, include: studentInclude });
}

export function toMatchInput(student: StudentRow): StudentMatchInput {
  return {
    age: student.studentProfile?.ageAtSignup ?? null,
    countryCode: "PK",
    nationality: "PK",
    cgpa: student.academicProfile?.cgpa ?? null,
    cgpaScale: student.academicProfile?.cgpaScale ?? 4.0,
    degreeLevel: student.studentProfile?.degreeLevel ?? null,
    field: student.studentProfile?.field ?? null,
    enrollmentStatus: student.studentProfile?.enrollmentStatus ?? null,
    financialNeedScore: student.financialProfile?.needScore ?? null,
    annualTuition: student.financialProfile?.tuitionAnnual ?? null,
    documentsOnHand: parseJson<string[]>(student.studentProfile?.documentsOnHand ?? null, []),
    holdsPriorScholarship: false,
  };
}

type OpportunityRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  provider: string;
  countryCode: string | null;
  description: string | null;
  categories: string | null;
  deadline: Date | null;
  applyUrl: string | null;
  verificationStatus: string;
  sourceUrl: string | null;
  lastVerifiedAt: Date | null;
  isPaid: boolean;
  stipendMin: number | null;
  criteria: { id: string; code: string; operator: string; value: string; required: boolean; label: string | null }[];
  documents: { id: string; docCode: string; label: string; required: boolean }[];
  scholarship: {
    tuitionCoverage: string | null;
    tuitionCoveragePercent: number | null;
    coversLiving: boolean;
    coversTravel: boolean;
    stipendAmount: number | null;
  } | null;
};

const opportunityInclude = {
  criteria: true,
  documents: true,
  scholarship: true,
} as const;

function toEngineOpportunity(row: OpportunityRow): OpportunityForMatching {
  const categories = parseJson<string[]>(row.categories, []);
  return {
    id: row.id,
    title: row.title,
    type: row.type as OpportunityForMatching["type"],
    criteria: row.criteria.map(
      (criterion): Criterion => ({
        code: criterion.code as Criterion["code"],
        operator: criterion.operator as Criterion["operator"],
        value: parseJson<Record<string, unknown>>(criterion.value, {}),
        required: criterion.required,
        label: criterion.label ?? undefined,
      }),
    ),
    isNeedBased: categories.includes("NEED_BASED"),
    isMeritBased: categories.includes("MERIT_BASED"),
    tuitionCoverage: (row.scholarship?.tuitionCoverage ?? null) as OpportunityForMatching["tuitionCoverage"],
    tuitionCoveragePercent: row.scholarship?.tuitionCoveragePercent ?? null,
    coversLiving: row.scholarship?.coversLiving ?? false,
    coversTravel: row.scholarship?.coversTravel ?? false,
    stipendAmount: row.scholarship?.stipendAmount ?? row.stipendMin,
    requiredDocuments: row.documents.filter((d) => d.required).map((d) => d.docCode),
    deadline: toDateOnly(row.deadline),
    verificationStatus: row.verificationStatus as OpportunityForMatching["verificationStatus"],
    lastVerifiedAt: toDateOnly(row.lastVerifiedAt),
  };
}

export interface MatchView {
  student: StudentRow;
  need: FinancialNeedResult;
  summary: MatchSummary;
  opportunities: Map<string, OpportunityRow>;
  /** Ranked, with the matching result attached. */
  ranked: {
    row: OpportunityRow;
    result: MatchSummary["eligible"][number];
  }[];
  nearMisses: {
    row: OpportunityRow;
    result: MatchSummary["nearMisses"][number];
  }[];
}

export async function getMatchView(email: string): Promise<MatchView | null> {
  const student = await loadStudent(email);
  if (!student) return null;

  const financial = student.financialProfile;
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

  const rows = await prisma.opportunity.findMany({
    where: { isActive: true },
    include: opportunityInclude,
    orderBy: { title: "asc" },
  });

  const summary = matchOpportunities(
    rows.map(toEngineOpportunity),
    toMatchInput(student),
    todayISO(),
    PK_MATCH_POLICY,
  );

  const opportunities = new Map(rows.map((row) => [row.id, row]));

  return {
    student,
    need,
    summary,
    opportunities,
    ranked: summary.eligible
      .map((result) => ({ row: opportunities.get(result.opportunityId)!, result }))
      .filter((entry) => Boolean(entry.row)),
    nearMisses: summary.nearMisses
      .map((result) => ({ row: opportunities.get(result.opportunityId)!, result }))
      .filter((entry) => Boolean(entry.row)),
  };
}

export async function getOpportunityBySlug(slug: string): Promise<OpportunityRow | null> {
  return prisma.opportunity.findUnique({ where: { slug }, include: opportunityInclude });
}

export async function listOpportunities(): Promise<OpportunityRow[]> {
  return prisma.opportunity.findMany({
    where: { isActive: true },
    include: opportunityInclude,
    orderBy: { title: "asc" },
  });
}

export interface WellbeingSnapshot {
  latest: {
    day: string;
    moodCode: string;
    stressLevel: number;
    note: string | null;
    tags: string[];
    dominantConcern: string | null;
    confidence: number | null;
    scores: Record<string, number> | null;
    crisisDetected: boolean;
  } | null;
  history: { day: string; stressLevel: number; dominantConcern: string | null; tags: string[] }[];
  averageStress: number | null;
}

export async function getWellbeing(email: string): Promise<WellbeingSnapshot> {
  const checkins = await prisma.wellbeingCheckin.findMany({
    where: { user: { email } },
    orderBy: { day: "desc" },
    take: 14,
    include: {
      factors: true,
      analysis: true,
    },
  });

  const mapRow = (checkin: (typeof checkins)[number]) => ({
    day: checkin.day,
    stressLevel: checkin.stressLevel,
    dominantConcern: checkin.analysis?.dominantConcern ?? null,
    tags: checkin.factors.map((factor) => factor.factorCode),
  });

  const latestCheckin = checkins[0];
  return {
    latest: latestCheckin
      ? {
          day: latestCheckin.day,
          moodCode: latestCheckin.moodCode,
          stressLevel: latestCheckin.stressLevel,
          note: latestCheckin.note,
          tags: latestCheckin.factors.map((factor) => factor.factorCode),
          dominantConcern: latestCheckin.analysis?.dominantConcern ?? null,
          confidence: latestCheckin.analysis?.confidence ?? null,
          scores: parseJson<Record<string, number> | null>(
            latestCheckin.analysis?.scores ?? null,
            null,
          ),
          crisisDetected: latestCheckin.analysis?.crisisDetected ?? false,
        }
      : null,
    history: checkins.map(mapRow).reverse(),
    averageStress: checkins.length
      ? Math.round((checkins.reduce((sum, c) => sum + c.stressLevel, 0) / checkins.length) * 10) / 10
      : null,
  };
}

export async function listSupportServices(): Promise<
  { id: string; type: string; name: string; org: string; phone: string | null; website: string | null; openingHours: string | null; isEmergency: boolean; verificationStatus: string }[]
> {
  return prisma.supportService.findMany({
    orderBy: [{ isEmergency: "desc" }, { name: "asc" }],
  });
}

export async function listResources(): Promise<
  { id: string; category: string; title: string; summary: string; url: string | null }[]
> {
  return prisma.resource.findMany({ where: { reviewStatus: "APPROVED" }, orderBy: { title: "asc" } });
}
