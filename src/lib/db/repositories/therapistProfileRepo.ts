import type { DrizzleDB } from "../provider";
import { therapistProfile } from "../schema";
import type { Therapist } from "@/types";

/** Single-row cache — replaced wholesale on every successful profile fetch. */
export async function getCachedTherapistProfile(db: DrizzleDB): Promise<Therapist | null> {
  const rows = await db.select().from(therapistProfile).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    specialization: row.specialization,
    qualifications: row.qualifications,
    experienceYears: row.experienceYears,
    rating: row.rating,
    avatarUrl: row.avatarUrl ?? undefined,
    isOnline: row.isOnline,
    isVerified: row.isVerified,
    clinicName: row.clinicName ?? undefined,
  };
}

export async function cacheTherapistProfile(db: DrizzleDB, therapist: Therapist): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(therapistProfile);
    await tx.insert(therapistProfile).values({
      id: therapist.id,
      name: therapist.name,
      phone: therapist.phone,
      email: therapist.email ?? null,
      specialization: therapist.specialization,
      qualifications: therapist.qualifications,
      experienceYears: therapist.experienceYears,
      rating: therapist.rating,
      avatarUrl: therapist.avatarUrl ?? null,
      isOnline: therapist.isOnline,
      isVerified: therapist.isVerified,
      clinicName: therapist.clinicName ?? null,
      cachedAt: Date.now(),
    });
  });
}
