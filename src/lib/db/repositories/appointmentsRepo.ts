import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { appointments } from "../schema";
import type { Appointment } from "@/types";

function fromRow(row: typeof appointments.$inferSelect): Appointment {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName,
    patientAvatarUrl: row.patientAvatarUrl ?? undefined,
    patientAge: row.patientAge ?? undefined,
    patientGender: row.patientGender ?? undefined,
    patientPhone: row.patientPhone ?? undefined,
    time: row.time,
    timeLabel: row.timeLabel,
    meridiem: row.meridiem as Appointment["meridiem"],
    type: row.type as Appointment["type"],
    status: row.status as Appointment["status"],
    paymentStatus: row.paymentStatus as Appointment["paymentStatus"],
    amount: row.amount,
    condition: row.condition,
    address: row.address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    distanceKm: row.distanceKm ?? undefined,
    etaMin: row.etaMin ?? undefined,
    notes: row.notes ?? undefined,
    insurance: row.insurance ?? undefined,
    workflowStep: row.workflowStep,
  };
}

export async function getCachedAppointments(db: DrizzleDB): Promise<Appointment[]> {
  const rows = await db.select().from(appointments);
  return rows.map(fromRow);
}

export async function getCachedAppointmentById(db: DrizzleDB, id: string): Promise<Appointment | null> {
  const rows = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function cacheAppointments(db: DrizzleDB, list: Appointment[]): Promise<void> {
  const cachedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(appointments);
    if (list.length === 0) return;
    await tx.insert(appointments).values(
      list.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patientName,
        patientAvatarUrl: a.patientAvatarUrl ?? null,
        patientAge: a.patientAge ?? null,
        patientGender: a.patientGender ?? null,
        patientPhone: a.patientPhone ?? null,
        time: a.time,
        timeLabel: a.timeLabel,
        meridiem: a.meridiem,
        type: a.type,
        status: a.status,
        paymentStatus: a.paymentStatus,
        amount: a.amount,
        condition: a.condition,
        address: a.address ?? null,
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        distanceKm: a.distanceKm ?? null,
        etaMin: a.etaMin ?? null,
        notes: a.notes ?? null,
        insurance: a.insurance ?? null,
        workflowStep: a.workflowStep,
        cachedAt,
      })),
    );
  });
}
