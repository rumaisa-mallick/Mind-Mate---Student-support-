"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { classifyConcerns, type CheckinFactor } from "@/domain/wellbeing/classifier";

const CheckinSchema = z.object({
  email: z.string().email(),
  moodCode: z.enum(["GOOD", "OK", "NEUTRAL", "STRESSED", "VERY_STRESSED"]),
  stressLevel: z.coerce.number().int().min(1).max(10),
  note: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
});

export interface CheckinState {
  ok: boolean;
  message?: string;
  dominantConcern?: string;
  crisisDetected?: boolean;
}

/** Plain form action (no useActionState) — the page re-reads the saved result. */
export async function createCheckin(formData: FormData): Promise<void> {
  const parsed = CheckinSchema.safeParse({
    email: formData.get("email"),
    moodCode: formData.get("moodCode"),
    stressLevel: formData.get("stressLevel"),
    note: formData.get("note") ?? undefined,
    tags: formData.getAll("tags").map(String),
  });

  if (!parsed.success) return;

  const { email, moodCode, stressLevel, note, tags } = parsed.data;
  const day = new Date().toISOString().slice(0, 10);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const analysis = classifyConcerns({
    note: note ?? null,
    tags: tags as CheckinFactor[],
  });

  await prisma.$transaction(async (tx) => {
    const checkin = await tx.wellbeingCheckin.create({
      data: {
        userId: user.id,
        day,
        moodCode,
        stressLevel,
        note: note ?? null,
        consentToAnalyze: true,
        factors: { create: tags.map((factorCode) => ({ factorCode })) },
      },
    });

    await tx.concernAnalysis.create({
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
  });

  revalidatePath("/checkin");
  revalidatePath("/");
}
