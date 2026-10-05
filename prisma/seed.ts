/**
 * Seed: Pakistan config + public opportunity data + synthetic demo students.
 *
 * Idempotent — clears and re-inserts. Run with: npm run db:seed
 *
 * No real student data is used anywhere. The demo students are synthetic
 * fixtures, and every financial figure is invented.
 */

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

import {
  PK_INCOME_BANDS_MONTHLY,
  PK_WEIGHT_SET_V1,
  PK,
} from "../src/config/pakistan";
import { computeFinancialNeed } from "../src/domain/financial/score";
import { classifyConcerns } from "../src/domain/wellbeing/classifier";
import { PK_DEMO_STUDENTS, PK_HEC_PROGRAMMES, PK_OPPORTUNITIES, PK_SUPPORT_SERVICES } from "./seed-data-pk";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main(): Promise<void> {
  console.log("Seeding MindMate (Pakistan, public data)…\n");

  // Order matters: children before parents where FKs are enforced.
  await prisma.scholarshipMatch.deleteMany();
  await prisma.matchRun.deleteMany();
  await prisma.application.deleteMany();
  await prisma.savedOpportunity.deleteMany();
  await prisma.concernAnalysis.deleteMany();
  await prisma.checkinFactor.deleteMany();
  await prisma.wellbeingCheckin.deleteMany();
  await prisma.opportunityCriterion.deleteMany();
  await prisma.opportunityDocument.deleteMany();
  await prisma.scholarship.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.academicProfile.deleteMany();
  await prisma.financialProfile.deleteMany();
  await prisma.personalisationProfile.deleteMany();
  await prisma.budgetPlan.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.incomeBandConfig.deleteMany();
  await prisma.scoringWeightSet.deleteMany();
  await prisma.supportService.deleteMany();
  await prisma.resource.deleteMany();

  // ── Config ────────────────────────────────────────────────────────────────
  for (const [index, band] of PK_INCOME_BANDS_MONTHLY.entries()) {
    await prisma.incomeBandConfig.create({
      data: {
        countryCode: PK.countryCode,
        currency: PK.currency,
        period: "MONTHLY",
        code: band.code,
        label: band.label,
        minAmount: band.min,
        maxAmount: band.max,
        sortOrder: index,
      },
    });
  }
  console.log(`  ✓ ${PK_INCOME_BANDS_MONTHLY.length} income bands (${PK.currency}/month)`);

  await prisma.scoringWeightSet.create({
    data: {
      version: PK_WEIGHT_SET_V1.version,
      effectiveFrom: new Date("2026-01-01"),
      weights: JSON.stringify(PK_WEIGHT_SET_V1.weights),
      anchors: JSON.stringify(PK_WEIGHT_SET_V1.anchors),
      bands: JSON.stringify(PK_WEIGHT_SET_V1.bands),
      note: "Pakistan v1 — initial published weights (plan §4.1)",
    },
  });
  console.log(`  ✓ scoring weight set v${PK_WEIGHT_SET_V1.version}`);

  // ── Support services ──────────────────────────────────────────────────────
  // All UNVERIFIED on purpose: the UI must not present unverified contacts as
  // authoritative, and crisis numbers need a human to confirm them (plan §6.3).
  for (const service of PK_SUPPORT_SERVICES) {
    await prisma.supportService.create({
      data: {
        type: service.type,
        name: service.name,
        org: service.org,
        countryCode: service.countryCode,
        phone: service.phone,
        website: service.website,
        openingHours: service.openingHours,
        languages: JSON.stringify(service.languages),
        isEmergency: service.isEmergency,
        verificationStatus: "UNVERIFIED",
        requiresVerification: true,
      },
    });
  }
  console.log(`  ✓ ${PK_SUPPORT_SERVICES.length} support services (all UNVERIFIED)`);

  // ── Opportunities ─────────────────────────────────────────────────────────
  // Verified official-channel programmes first, then indicative public listings.
  const allOpportunities = [...PK_HEC_PROGRAMMES, ...PK_OPPORTUNITIES];
  for (const opportunity of allOpportunities) {
    await prisma.opportunity.create({
      data: {
        type: opportunity.type,
        slug: opportunity.slug,
        title: opportunity.title,
        provider: opportunity.provider,
        countryCode: opportunity.countryCode,
        description: opportunity.description,
        categories: JSON.stringify(opportunity.categories),
        // Omitted ⇒ NULL. We never assert a deadline we have not seen on the
        // official page, and past deadlines are kept so they report as closed.
        deadline: opportunity.deadline ? new Date(opportunity.deadline) : null,
        applyUrl: opportunity.applyUrl,
        isPaid: opportunity.isPaid,
        stipendMin: opportunity.stipendMin,
        verificationStatus: opportunity.verificationStatus ?? "UNVERIFIED",
        sourceUrl: opportunity.sourceUrl,
        lastVerifiedAt: opportunity.lastVerifiedAt
          ? new Date(`${opportunity.lastVerifiedAt}T00:00:00Z`) // date of the check, not a deadline
          : null,
        criteria: {
          create: opportunity.criteria.map((criterion, index) => ({
            code: criterion.code,
            operator: criterion.operator,
            value: JSON.stringify(criterion.value),
            required: true,
            label: criterion.label,
            sortOrder: index,
          })),
        },
        documents: {
          create: opportunity.documents.map((document) => ({
            docCode: document.docCode,
            label: document.label,
            required: document.required,
          })),
        },
        ...(opportunity.type === "SCHOLARSHIP"
          ? {
              scholarship: {
                create: {
                  tuitionCoverage: opportunity.tuitionCoverage,
                  tuitionCoveragePercent: opportunity.tuitionCoveragePercent,
                  coversLiving: opportunity.coversLiving,
                  coversTravel: opportunity.coversTravel,
                  stipendAmount: opportunity.stipendMin,
                  currency: PK.currency,
                },
              },
            }
          : {}),
      },
    });
  }
  console.log(`  ✓ ${allOpportunities.length} opportunities (${PK_HEC_PROGRAMMES.length} verified from hec.gov.pk)`);

  // ── Demo students ─────────────────────────────────────────────────────────
  for (const student of PK_DEMO_STUDENTS) {
    const user = await prisma.user.create({
      data: {
        email: student.email,
        name: student.name,
        role: "STUDENT",
        countryCode: PK.countryCode,
      },
    });

    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        city: student.city,
        university: student.university,
        degree: student.degree,
        degreeLevel: student.degreeLevel,
        currentSemester: student.currentSemester,
        enrollmentStatus: student.enrollmentStatus,
        field: student.field,
        graduationYear: student.graduationYear,
        ageAtSignup: student.ageAtSignup,
        gender: student.gender,
        documentsOnHand: JSON.stringify(student.documentsOnHand),
        profileComplete: true,
      },
    });

    await prisma.academicProfile.create({
      data: {
        userId: user.id,
        cgpa: student.cgpa,
        cgpaScale: 4.0,
        field: student.field,
        hatScore: student.hatScore,
      },
    });

    await prisma.personalisationProfile.create({
      data: {
        userId: user.id,
        primaryGoal: student.personalisation.primaryGoal,
        secondaryGoals: JSON.stringify(student.personalisation.secondaryGoals),
        stressTriggers: JSON.stringify(student.personalisation.stressTriggers),
        supportPreference: student.personalisation.supportPreference,
        availableHoursPerWeek: student.personalisation.availableHoursPerWeek,
        studyStyle: student.personalisation.studyStyle,
        commuteMinutes: student.personalisation.commuteMinutes,
        workCommitment: student.personalisation.workCommitment,
        caresForOthers: student.personalisation.caresForOthers,
        tonePreference: student.personalisation.tonePreference,
        completedAt: new Date(),
      },
    });

    // The planner is a pure function of these inputs, so only the inputs are
    // stored — the plan itself is recomputed on every page load.
    await prisma.budgetPlan.create({
      data: {
        userId: user.id,
        incomeSources: JSON.stringify(student.incomeSources),
        expenses: JSON.stringify(student.budgetExpenses),
        annualTuition: student.tuitionAnnual,
        termsPerYear: student.termsPerYear,
        bufferTargetMonths: 3,
      },
    });

    // Financial Need Score is computed by the domain engine and stored with the
    // weight-set version, so the number stays explainable later.
    const need = computeFinancialNeed(
      {
        incomeBandCode: student.incomeBandCode,
        earners: student.earners,
        dependents: student.dependents,
        annualTuition: student.tuitionAnnual,
        accommodationStatus: student.accommodationStatus as never,
        annualAccommodationCost: student.accommodationAnnual,
        existingAidCoverage: student.existingAidCoverage as never,
      },
      { weightSet: PK_WEIGHT_SET_V1, incomeBands: PK_INCOME_BANDS_MONTHLY },
    );

    await prisma.financialProfile.create({
      data: {
        userId: user.id,
        incomeBandCode: student.incomeBandCode,
        incomePeriod: "MONTHLY",
        earners: student.earners,
        dependents: student.dependents,
        tuitionAnnual: student.tuitionAnnual,
        accommodationStatus: student.accommodationStatus,
        accommodationAnnual: student.accommodationAnnual,
        existingAidCoverage: student.existingAidCoverage,
        assistanceRequired: student.assistanceRequired,
        consentToUseForMatching: true,
        needScore: need.score,
        needBand: need.band,
        weightSetVersion: PK_WEIGHT_SET_V1.version,
        scoredAt: new Date(),
      },
    });

    await prisma.consentRecord.createMany({
      data: [
        { userId: user.id, scope: "DATA_PROCESSING", granted: true, policyVersion: "1.0" },
        { userId: user.id, scope: "MATCHING", granted: true, policyVersion: "1.0" },
        { userId: user.id, scope: "AI_ANALYSIS", granted: false, policyVersion: "1.0" },
        { userId: user.id, scope: "AGGREGATED_ANALYTICS", granted: false, policyVersion: "1.0" },
      ],
    });

    console.log(
      `  ✓ ${student.name.padEnd(14)} need ${String(need.score).padStart(3)}/100 (${need.band})`,
    );
  }

  // ── A short wellbeing history for the first student ───────────────────────
  // Demonstrates the trend view and the concern → remedy routing.
  const first = await prisma.user.findUniqueOrThrow({ where: { email: PK_DEMO_STUDENTS[0].email } });

  const history: { day: string; mood: string; stress: number; tags: string[]; note?: string }[] = [
    { day: "2026-09-28", mood: "NEUTRAL", stress: 4, tags: ["CAREER"] },
    { day: "2026-09-30", mood: "STRESSED", stress: 6, tags: ["ASSIGNMENT", "SLEEP"] },
    {
      day: "2026-10-01",
      mood: "VERY_STRESSED",
      stress: 8,
      tags: ["MONEY", "FAMILY"],
      note: "I am extremely stressed because I do not know how I will pay my semester fees.",
    },
    {
      day: "2026-10-03",
      mood: "STRESSED",
      stress: 7,
      tags: ["MONEY", "EXAMS"],
      note: "Final exams are close and my family is also struggling financially.",
    },
    { day: "2026-10-05", mood: "NEUTRAL", stress: 5, tags: ["MONEY"] },
  ];

  for (const entry of history) {
    const checkin = await prisma.wellbeingCheckin.create({
      data: {
        userId: first.id,
        day: entry.day,
        moodCode: entry.mood,
        stressLevel: entry.stress,
        note: entry.note ?? null,
        consentToAnalyze: true,
        createdAt: new Date(`${entry.day}T12:00:00Z`),
        factors: { create: entry.tags.map((factorCode) => ({ factorCode })) },
      },
    });

    const analysis = classifyConcerns({ tags: entry.tags as never, note: entry.note });
    await prisma.concernAnalysis.create({
      data: {
        checkinId: checkin.id,
        engineVersion: analysis.engineVersion,
        engineMode: analysis.engineMode,
        scores: JSON.stringify(analysis.scores),
        dominantConcern: analysis.dominantConcern,
        confidence: analysis.confidence,
        evidence: JSON.stringify(analysis.evidence),
        crisisDetected: analysis.crisisDetected,
      },
    });
  }
  console.log(`  ✓ ${history.length} wellbeing check-ins with concern analysis`);

  console.log("\nDone. Start the app with: npm run dev");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
