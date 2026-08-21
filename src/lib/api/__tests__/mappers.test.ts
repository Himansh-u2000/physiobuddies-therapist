/**
 * Backend → app mappers, exercised against the REAL shapes the live physiobuddies-web backend
 * returns (captured from the running server + seed data during Phase 5 integration). These pin
 * the translation so a backend field rename can't silently feed the screens malformed data.
 */
import {
  mapUserToTherapist,
  mapBookings,
  mapBookingDetailToAppointment,
  mapBookingStatus,
  mapCommissionToTransaction,
  buildEarningsSummary,
  buildDashboardStats,
  buildPatientsFromBookings,
  mapAssessment,
  mapAssessmentToPayload,
  mapAvailability,
  mapWeeklySchedule,
  mapActivity,
  mapBlogPost,
  mapLoginSessions,
  deviceLabelFromAgent,
  type BackendUser,
  type BackendTherapistPublic,
  type BackendBooking,
  type BackendBookingDetail,
  type BackendCommission,
  type BackendWallet,
} from "@/lib/api/mappers";
import { API_BASE_URL } from "@/constants/config";

/** Where a server-relative `/uploads/...` path resolves to — the API base minus its `/api/v1`. */
const apiOrigin = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

/** Backend's display date format, e.g. "July 26, 2026". */
function displayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
}

const realUser: BackendUser = {
  id: "6a6256806701f64ad25779b4",
  email: "aarav@physiobuddies.com",
  name: "Dr. Aarav Mehta",
  role: "therapist",
  phone: "9000000101",
  image: null,
  therapistStatus: { isOnboardingFilled: true, isVerified: true, isFinalOnboardingFilled: true },
  therapistProfile: {
    id: "6a6256806701f64ad25779c1",
    about: "Experienced physiotherapist.",
    displayAddress: "Pitampura, New Delhi",
    location: { lat: 28.698, lng: 77.13 },
  },
};

const realPublic: BackendTherapistPublic = {
  id: "6a6256806701f64ad25779c1",
  name: "Dr. Aarav Mehta",
  specializations: ["Sports Physio", "Ortho Physio"],
  experience: 8,
  rating: 4.8,
  totalReviews: 1,
  originalPrice: 1199,
  discountedPrice: 799,
  displayAddress: "Pitampura, New Delhi",
  image: null,
  about: "Experienced physiotherapist.",
  distance: null,
};

describe("mapUserToTherapist", () => {
  it("merges identity (/user) with public profile (/therapist/:id)", () => {
    const t = mapUserToTherapist(realUser, realPublic);
    expect(t).toMatchObject({
      id: "6a6256806701f64ad25779b4",
      name: "Dr. Aarav Mehta",
      email: "aarav@physiobuddies.com",
      phone: "9000000101",
      specialization: "Sports Physio, Ortho Physio",
      experienceYears: 8,
      rating: 4.8,
      isVerified: true,
    });
  });

  it("degrades gracefully when the public profile is missing", () => {
    const t = mapUserToTherapist(realUser, null);
    expect(t.specialization).toBe("");
    expect(t.rating).toBe(0);
    expect(t.isVerified).toBe(true); // still known from /user
  });

  /**
   * A photo set from the web console is stored as the server-relative path multer returns.
   * React Native's <Image> silently renders nothing for a relative uri, so the account showed
   * its picture on the website and initials in the app.
   */
  it("absolutises a server-relative avatar path", () => {
    const t = mapUserToTherapist({ ...realUser, image: "/uploads/1786-avatar.jpg" }, null);
    expect(t.avatarUrl).toBe(`${apiOrigin}/uploads/1786-avatar.jpg`);
  });

  it("leaves an already-absolute avatar url alone", () => {
    const t = mapUserToTherapist({ ...realUser, image: "https://cdn.example/a.png" }, null);
    expect(t.avatarUrl).toBe("https://cdn.example/a.png");
  });

  it("falls back to the public profile photo, and to undefined when neither has one", () => {
    expect(
      mapUserToTherapist(realUser, { ...realPublic, image: "/uploads/pub.jpg" }).avatarUrl,
    ).toBe(`${apiOrigin}/uploads/pub.jpg`);
    expect(mapUserToTherapist(realUser, null).avatarUrl).toBeUndefined();
  });
});

describe("mapBookings", () => {
  const bookings: BackendBooking[] = [
    {
      id: "blocked-1",
      patientID: "PAT-101",
      patientName: "Patient",
      patientGender: "MALE",
      patientAge: null,
      treatmentMode: "home_visit",
      status: "BLOCKED",
      lastSessionDate: "July 26, 2026",
      lastSessionTime: "02:00 PM - 03:00 PM",
    },
    {
      id: "up-1",
      patientID: "PAT-2026-003",
      patientName: "Neha Gupta",
      patientGender: "FEMALE",
      patientAge: 33,
      treatmentMode: "home_visit",
      status: "UPCOMING",
      lastSessionDate: "July 25, 2026",
      lastSessionTime: "04:00 PM - 05:00 PM",
    },
    {
      id: "done-1",
      patientID: "PAT-2026-001",
      patientName: "Priya Sharma",
      patientGender: "FEMALE",
      patientAge: 31,
      treatmentMode: "clinic",
      status: "COMPLETED",
      lastSessionDate: "July 23, 2026",
      lastSessionTime: "10:00 AM - 11:00 AM",
    },
  ];

  it("drops BLOCKED (non-patient) slots", () => {
    const out = mapBookings(bookings);
    expect(out.map((a) => a.id)).toEqual(["up-1", "done-1"]);
  });

  it("maps status, type, time and patient fields", () => {
    const [upcoming, done] = mapBookings(bookings);
    expect(upcoming).toMatchObject({
      patientId: "PAT-2026-003",
      patientName: "Neha Gupta",
      patientGender: "female",
      patientAge: 33,
      type: "home",
      status: "confirmed",
      timeLabel: "04:00",
      meridiem: "PM",
    });
    expect(done).toMatchObject({ type: "clinic", status: "completed", meridiem: "AM" });
  });
});

describe("mapBookingDetailToAppointment", () => {
  const detail: BackendBookingDetail = {
    id: "booking-1",
    mode: "home_visit",
    overallStatus: "COMPLETED",
    patient: {
      id: "PAT-2026-001",
      name: "Priya Sharma",
      dob: "June 15, 1995",
      gender: "FEMALE",
      phone: "+91 98765 43210",
    },
    condition: { title: "Lower back pain" },
    problemDescription: "Chronic discomfort after sitting",
    location: {
      address: "100 Green Avenue",
      landmark: "Near City Park",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110002",
    },
    sessions: [
      { id: "sess-1", date: "2026-07-23T00:00:00.000Z", scheduledTime: "10:00 AM - 11:00 AM", status: "completed" },
    ],
    documents: [],
    clinicalAssessments: [],
  };

  it("flattens the nested detail into an Appointment", () => {
    const a = mapBookingDetailToAppointment(detail);
    expect(a).toMatchObject({
      id: "booking-1",
      patientId: "PAT-2026-001",
      patientName: "Priya Sharma",
      patientGender: "female",
      patientPhone: "+91 98765 43210",
      type: "home",
      status: "completed",
      condition: "Lower back pain",
      notes: "Chronic discomfort after sitting",
      timeLabel: "10:00",
      meridiem: "AM",
      workflowStep: 5,
    });
    expect(a.address).toContain("100 Green Avenue");
    expect(a.address).toContain("110002");
  });

  it("exposes the plan's sessions and counts them", () => {
    const a = mapBookingDetailToAppointment(detail);
    expect(a.sessions).toHaveLength(1);
    expect(a.sessionCount).toBe(1);
    expect(a.completedSessionCount).toBe(1);
  });

  it("leaves currentSessionId unset when every session is finished", () => {
    // The lifecycle calls (OTP, end, assessment) must have nothing to point at once the
    // course of treatment is over — a stale id here would let the UI offer "start session"
    // on a completed plan and 404 against the backend.
    expect(mapBookingDetailToAppointment(detail).currentSessionId).toBeUndefined();
  });

  it("points currentSessionId at the ACTIVE session, not the earliest one", () => {
    const a = mapBookingDetailToAppointment({
      ...detail,
      overallStatus: "ACTIVE",
      sessions: [
        { id: "s-early", date: "2026-07-20T00:00:00.000Z", scheduledTime: "09:00 AM - 09:40 AM", status: "confirmed" },
        { id: "s-live", date: "2026-07-23T00:00:00.000Z", scheduledTime: "10:00 AM - 10:40 AM", status: "active" },
      ],
    });
    expect(a.currentSessionId).toBe("s-live");
    expect(a.status).toBe("in_progress");
  });

  it("orders sessions earliest-first even though the backend sends them newest-first", () => {
    const a = mapBookingDetailToAppointment({
      ...detail,
      sessions: [
        { id: "s-late", date: "2026-08-12T00:00:00.000Z", scheduledTime: "06:00 AM - 06:40 AM", status: "confirmed" },
        { id: "s-early", date: "2026-08-10T00:00:00.000Z", scheduledTime: "05:00 PM - 05:40 PM", status: "completed" },
      ],
    });
    expect(a.sessions?.map((s) => s.id)).toEqual(["s-early", "s-late"]);
    expect(a.currentSessionId).toBe("s-late");
  });

  // The therapist route omits `location.coords` today, so the app navigates by address text.
  // These pin the behaviour both ways round: no coordinates must stay `undefined` (so the route
  // screen takes the address path), and real ones must come through (so it stops the day the
  // backend starts sending them).
  it("leaves coordinates unset when the backend omits them, as it does today", () => {
    const a = mapBookingDetailToAppointment(detail);
    expect(a.latitude).toBeUndefined();
    expect(a.longitude).toBeUndefined();
  });

  it("reads coordinates from location.coords when the backend sends them", () => {
    const a = mapBookingDetailToAppointment({
      ...detail,
      location: { ...detail.location, coords: { lat: 28.6139, lng: 77.209 } },
    });
    expect(a.latitude).toBe(28.6139);
    expect(a.longitude).toBe(77.209);
  });

  it("rejects a half-populated or null-island coordinate pair", () => {
    // Either of these would send navigation to 0,0 off the coast of Africa instead of falling
    // back to the address the screen already displays.
    const partial = mapBookingDetailToAppointment({
      ...detail,
      location: { ...detail.location, coords: { lat: 28.6139 } },
    });
    expect(partial.latitude).toBeUndefined();
    expect(partial.longitude).toBeUndefined();

    const nullIsland = mapBookingDetailToAppointment({
      ...detail,
      location: { ...detail.location, coords: { lat: 0, lng: 0 } },
    });
    expect(nullIsland.latitude).toBeUndefined();
    expect(nullIsland.longitude).toBeUndefined();
  });
});

describe("mapBookingStatus", () => {
  // CONFIRMED is the most common value the live API returns for a paid, scheduled visit.
  // It used to fall through to "pending", which mislabelled nearly every appointment.
  it.each([
    ["CONFIRMED", "confirmed"],
    ["UPCOMING", "confirmed"],
    ["ONGOING", "confirmed"],
    ["ACTIVE", "in_progress"],
    ["COMPLETED", "completed"],
    ["SETTLED", "completed"],
    ["CANCELLED", "cancelled"],
    ["PATIENT_NO_SHOW", "no_show"],
    ["THERAPIST_NO_SHOW", "no_show"],
    ["NO_SHOW", "no_show"],
    ["EXPIRED", "expired"],
    ["PENDING", "pending"],
  ])("maps %s → %s", (raw, expected) => {
    expect(mapBookingStatus(raw)).toBe(expected);
  });
});

describe("mapCommissionToTransaction", () => {
  it("uses the therapist's net amount and marks it paid", () => {
    const c: BackendCommission = {
      id: "comm-1",
      sessionDate: new Date().toISOString(),
      patientName: "Priya Sharma",
      sessionAmount: 799,
      platformFee: 160,
      therapistAmount: 639,
    };
    const t = mapCommissionToTransaction(c);
    expect(t).toMatchObject({ patientName: "Priya Sharma", amount: 639, type: "session", status: "paid" });
    expect(t.dateLabel).toBe("Today");
  });
});

describe("buildEarningsSummary", () => {
  it("takes pending payout from the wallet balance and builds a 7-day chart", () => {
    const commissions: BackendCommission[] = [
      { id: "c1", sessionDate: new Date().toISOString(), patientName: "P", sessionAmount: 799, platformFee: 160, therapistAmount: 639 },
    ];
    const wallet: BackendWallet = { balance: 639, entries: [] };
    const s = buildEarningsSummary(commissions, wallet);
    expect(s.pendingPayout).toBe(639);
    expect(s.weeklyChart).toHaveLength(7);
    expect(s.weeklyChart.filter((d) => d.isToday)).toHaveLength(1);
    expect(s.totalThisWeek).toBeGreaterThanOrEqual(639);
  });
});

describe("buildDashboardStats", () => {
  it("counts today's bookings, passes rating through, sums today's earnings", () => {
    const today = new Date();
    const commissions: BackendCommission[] = [
      { id: "c1", sessionDate: today.toISOString(), patientName: "P", sessionAmount: 799, platformFee: 160, therapistAmount: 639 },
    ];
    const bookings: BackendBooking[] = [
      { id: "b1", patientID: "P1", patientName: "P", status: "UPCOMING", lastSessionDate: displayDate(today), lastSessionTime: "10:00 AM - 11:00 AM" },
      { id: "b2", patientID: "P2", patientName: "Q", status: "BLOCKED", lastSessionDate: displayDate(today), lastSessionTime: "02:00 PM - 03:00 PM" },
    ];
    const stats = buildDashboardStats(commissions, bookings, 4.8);
    expect(stats.todaySessions).toBe(1); // blocked slot excluded
    expect(stats.rating).toBe(4.8);
    expect(stats.earnedToday).toBe(639);
    expect(stats.weeklyChart).toHaveLength(7);
  });
});

describe("mapAssessment", () => {
  // Captured verbatim from GET /treatment-session/:id/assessment on api.dev.physiobuddies.in.
  const stored = {
    id: "6a79be561fa1008e3ed523f1",
    treatmentPlanId: "6a79a0f2af91e546c60bd28b",
    assessmentType: "ORTHO",
    chiefComplaint: ["Pain", "Stiffness"],
    durationOfSymptoms: "ONE_TO_THREE_MONTHS",
    painScore: 5,
    painCharacteristics: ["Sharp", "Dull"],
    rom: "Mild_Restriction",
    muscleStrength: "Mild_Weakness",
    mobilityDetails: {
      mobilityStatus: "Independent",
      assistiveDevice: "Walker",
      fallRisk: "Moderate",
      functionalLimitations: [],
    },
    surgicalDetails: null,
    sportsDetails: null,
    neurologicalDetails: null,
    cardiopulmonaryVitals: null,
    problemsIdentified: ["Decreased ROM"],
    treatmentPlanItems: ["Manual Therapy"],
    visitFrequency: "Alternate_Days",
    suggestedTreatmentDays: 2,
    hepGiven: true,
    therapistNotes: "responded well",
    documentUrls: [],
    createdAt: new Date().toISOString(),
  };

  it("flattens the nested composite blocks back out", () => {
    const a = mapAssessment(stored);
    expect(a).toMatchObject({
      assessmentType: "ORTHO",
      painScore: 5,
      rom: "Mild_Restriction",
      mobilityStatus: "Independent",
      assistiveDevice: "Walker",
      fallRisk: "Moderate",
      treatmentPlanItems: ["Manual Therapy"],
      hepGiven: true,
    });
  });

  it("falls back rather than trusting an unknown enum value off the wire", () => {
    const a = mapAssessment({ ...stored, assessmentType: "SOMETHING_NEW", rom: "??" });
    expect(a.assessmentType).toBe("GENERAL");
    expect(a.rom).toBe("Full");
  });
});

describe("mapAssessmentToPayload", () => {
  const input = {
    assessmentType: "ORTHO" as const,
    chiefComplaint: ["Pain"],
    durationOfSymptoms: "ONE_TO_THREE_MONTHS" as const,
    painScore: 5,
    painCharacteristics: ["Sharp"],
    rom: "Full" as const,
    muscleStrength: "Normal" as const,
    problemsIdentified: ["Decreased ROM"],
    treatmentPlanItems: ["Manual Therapy", "Therapeutic Exercise"],
    visitFrequency: "Daily" as const,
    hepGiven: false,
  };

  // The backend reads the techniques array from `treatmentPlan` and writes it to
  // `treatmentPlanItems`. Sending `treatmentPlanItems` would store an empty array silently.
  it("renames treatmentPlanItems → treatmentPlan on the way out", () => {
    const body = mapAssessmentToPayload(input);
    expect(body.treatmentPlan).toEqual(["Manual Therapy", "Therapeutic Exercise"]);
    expect(body).not.toHaveProperty("treatmentPlanItems");
  });

  it("omits undefined optionals instead of sending explicit nulls", () => {
    const body = mapAssessmentToPayload({ ...input, surgeryType: undefined });
    expect(body).not.toHaveProperty("surgeryType");
    expect(body).not.toHaveProperty("fallRisk");
  });
});

describe("mapAvailability", () => {
  it("derives the block-able start hour from the server's startMinute/durationMinutes", () => {
    const [day] = mapAvailability([
      {
        date: "18-08-2026",
        timeSlots: [
          { startMinute: 360, durationMinutes: 40, category: "morning", status: "booked" },
          { startMinute: 1260, durationMinutes: 40, category: "night", status: "open" },
        ],
      },
    ]);
    expect(day.date).toBe("2026-08-18");
    expect(day.slots.map((s) => s.startHour)).toEqual([6, 21]);
    expect(day.slots[0]).toMatchObject({ startTime: 360, endTime: 400, status: "booked" });
  });

  it("still reads the older startHour/startTime/endTime slot form", () => {
    const [day] = mapAvailability([
      { date: "18-08-2026", timeSlots: [{ startHour: 9, startTime: 540, endTime: 580 }] },
    ]);
    expect(day.slots[0]).toMatchObject({ startHour: 9, startTime: 540, endTime: 580 });
  });
});

describe("mapWeeklySchedule", () => {
  it("normalises the bare-array day form written by onboarding", () => {
    const s = mapWeeklySchedule({ schedule: { monday: ["morning", "evening"] } });
    expect(s.monday).toEqual({ shifts: ["morning", "evening"], disabledHours: [] });
  });

  it("keeps disabledHours from the object form", () => {
    const s = mapWeeklySchedule({ schedule: { friday: { shifts: ["night"], disabledHours: [20] } } });
    expect(s.friday).toEqual({ shifts: ["night"], disabledHours: [20] });
  });

  it("drops shift values it doesn't recognise", () => {
    const s = mapWeeklySchedule({ schedule: { sunday: ["morning", "midnight"] } });
    expect(s.sunday.shifts).toEqual(["morning"]);
  });
});

describe("buildPatientsFromBookings", () => {
  const day = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });

  it("collapses repeat plans for the same person into one roster row", () => {
    const patients = buildPatientsFromBookings([
      { id: "p1", patientID: "PAT-1", patientName: "Prem Raj", patientAge: 21, patientGender: "MALE", status: "CONFIRMED", lastSessionDate: day("2026-08-12") },
      { id: "p2", patientID: "PAT-1", patientName: "Prem Raj", patientAge: 21, patientGender: "MALE", status: "COMPLETED", lastSessionDate: day("2026-08-10") },
      { id: "p3", patientID: "PAT-1", patientName: "Priya Sharma", patientAge: 31, patientGender: "FEMALE", status: "COMPLETED", lastSessionDate: day("2026-08-04") },
    ]);
    expect(patients).toHaveLength(2);
    expect(patients[0]).toMatchObject({ name: "Prem Raj", totalSessions: 2, gender: "male" });
    expect(patients[1]).toMatchObject({ name: "Priya Sharma", totalSessions: 1, gender: "female" });
  });

  it("excludes therapist-blocked slots, which carry no patient", () => {
    const patients = buildPatientsFromBookings([
      { id: "b1", patientID: "", patientName: "", status: "BLOCKED" },
      { id: "b2", patientID: "PAT-1", patientName: "Prem Raj", status: "CONFIRMED", lastSessionDate: day("2026-08-12") },
    ]);
    expect(patients.map((p) => p.name)).toEqual(["Prem Raj"]);
  });
});

describe("deviceLabelFromAgent", () => {
  // The app reports okhttp on Android (React Native's networking layer) — NOT a browser UA.
  // Confirmed against a real device session in GET /user/sessions/.
  it("recognises the app's own Android user-agent", () => {
    expect(deviceLabelFromAgent("okhttp/4.9.2")).toBe("Physiobuddies app (Android)");
  });

  it("picks Chrome over Safari — every Chrome UA also contains 'Safari'", () => {
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
    expect(deviceLabelFromAgent(chrome)).toBe("Chrome");
  });

  it("picks Edge over Chrome — Edge UAs contain both", () => {
    const edge =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edg/120";
    expect(deviceLabelFromAgent(edge)).toBe("Microsoft Edge");
  });

  it("labels API clients so probe sessions are identifiable", () => {
    expect(deviceLabelFromAgent("curl/8.11.0")).toBe("API client");
  });

  it("falls back to the raw agent rather than a fabricated guess", () => {
    // The therapist is being asked whether to revoke this — "Unknown device" would be worse
    // than showing them the string.
    expect(deviceLabelFromAgent("SomeNewClient/1.0")).toBe("SomeNewClient/1.0");
    expect(deviceLabelFromAgent("")).toBe("Unknown device");
  });
});

describe("mapLoginSessions", () => {
  const rows = [
    { id: "a", agent: "curl/8.11.0", ip: "::ffff:10.1.8.210", lastLoggedAt: "2026-08-10T10:00:00.000Z", isCurrentSession: false },
    { id: "b", agent: "okhttp/4.9.2", ip: "::ffff:10.1.25.254", lastLoggedAt: "2026-08-11T15:51:06.978Z", isCurrentSession: false },
  ];

  it("strips the IPv6-mapped-IPv4 prefix the server emits", () => {
    expect(mapLoginSessions(rows)[0].ip).toBe("10.1.25.254");
  });

  it("sorts most-recently-active first", () => {
    expect(mapLoginSessions(rows).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("marks the current session only when the caller supplies its id", () => {
    // The backend's own isCurrentSession is false on every row, including the caller's, so
    // trusting it would mean never marking the device in hand.
    expect(mapLoginSessions(rows).every((s) => !s.isCurrent)).toBe(true);
    expect(mapLoginSessions(rows, "b").find((s) => s.id === "b")?.isCurrent).toBe(true);
  });
});

describe("mapActivity", () => {
  it("passes a plain sentence through", () => {
    const [entry] = mapActivity([
      { id: "1", title: "User Logged In", data: "User aarav@physiobuddies.com logged in successfully" },
    ]);
    expect(entry.detail).toBe("User aarav@physiobuddies.com logged in successfully");
  });

  it("reduces a logged request blob to METHOD /path, dropping the body", () => {
    // The raw value embeds the request body, which is unreadable in a row and more than should
    // be casually rendered.
    const [entry] = mapActivity([
      {
        id: "2",
        title: "POST /file-upload/single",
        data: '{"method":"POST","path":"/file-upload/single","body":{"kind":"kyc"},"status":200}',
      },
    ]);
    expect(entry.detail).toBe("POST /file-upload/single · 200");
    expect(entry.detail).not.toContain("kyc");
  });

  it("yields an empty detail for an unparseable blob rather than dumping JSON", () => {
    expect(mapActivity([{ id: "3", title: "x", data: "{not json" }])[0].detail).toBe("");
  });
});

describe("mapBlogPost", () => {
  it("splits the comma-separated tags STRING into an array", () => {
    const post = mapBlogPost({
      id: "1",
      slug: "s",
      title: "T",
      summary: "S",
      tags: "back, stretching ,wellness",
      views: 120,
    });
    expect(post.tags).toEqual(["back", "stretching", "wellness"]);
  });

  it("tolerates missing tags without producing an empty-string tag", () => {
    expect(mapBlogPost({ id: "1", slug: "s", title: "T" }).tags).toEqual([]);
  });
});

