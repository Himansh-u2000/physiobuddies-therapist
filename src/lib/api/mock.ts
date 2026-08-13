import type {
  Therapist,
  DashboardStats,
  Patient,
  Appointment,
  Transaction,
  EarningsSummary,
  AppNotification,
  Payout,
  WalletInfo,
  TherapistReview,
  AvailabilityDay,
  TherapistArticle,
  TherapistFaq,
} from "@/types";

export const mockTherapist: Therapist = {
  id: "therapist-1",
  name: "Dr. Himanshu",
  phone: "+919876543210",
  email: "himanshu@physiobuddies.in",
  specialization: "MPT Orthopedics",
  qualifications: "MPT (Ortho), BPT",
  experienceYears: 8,
  rating: 4.8,
  isOnline: true,
  isVerified: true,
  clinicName: "Physiobuddies Clinic",
};

export const mockDashboardStats: DashboardStats = {
  todaySessions: 3,
  earnedToday: 4850,
  rating: 4.8,
  weeklyEarnings: 28400,
  weeklyChangePercent: 12,
  weeklyChart: [
    { day: "Mon", amount: 2800, isToday: false },
    { day: "Tue", amount: 4100, isToday: false },
    { day: "Wed", amount: 3600, isToday: false },
    { day: "Thu", amount: 4900, isToday: true },
    { day: "Fri", amount: 3200, isToday: false },
    { day: "Sat", amount: 2100, isToday: false },
    { day: "Sun", amount: 1800, isToday: false },
  ],
  pendingTasks: 3,
};

export const mockPatients: Patient[] = [
  {
    id: "p-amit",
    name: "Amit Verma",
    age: 42,
    gender: "male",
    phone: "+919812345678",
    condition: "Lower back pain rehab",
    address: "Flat 804, Sea View Residency, Turner Rd, Bandra West, Mumbai — 400050",
    totalSessions: 14,
    lastVisit: "28 May 2026",
    tags: ["Home visit", "L4-L5", "Chronic"],
  },
  {
    id: "p-neha",
    name: "Neha Sharma",
    age: 35,
    gender: "female",
    phone: "+919812345679",
    condition: "Post-surgery knee rehab",
    totalSessions: 8,
    lastVisit: "1 Jun 2026",
    tags: ["Clinic", "Post-op", "Knee"],
  },
  {
    id: "p-rohan",
    name: "Rohan Mehta",
    age: 28,
    gender: "male",
    phone: "+919812345680",
    condition: "Shoulder impingement",
    totalSessions: 5,
    lastVisit: "3 Jun 2026",
    tags: ["Online", "Shoulder"],
  },
  {
    id: "p-priya",
    name: "Priya Nair",
    age: 52,
    gender: "female",
    phone: "+919812345681",
    condition: "Cervical spondylosis",
    totalSessions: 11,
    lastVisit: "30 May 2026",
    tags: ["Home visit", "Neck", "Chronic"],
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: "appt-1",
    patientId: "p-amit",
    patientName: "Amit Verma",
    patientAge: 42,
    patientGender: "male",
    patientPhone: "+919812345678",
    time: "10:30",
    timeLabel: "10:30",
    meridiem: "AM",
    type: "home",
    status: "confirmed",
    paymentStatus: "paid",
    amount: 1200,
    condition: "Lower back pain rehab",
    address: "Flat 804, Sea View Residency, Turner Rd, Bandra West, Mumbai — 400050",
    latitude: 19.0596,
    longitude: 72.8295,
    distanceKm: 5.2,
    etaMin: 18,
    notes:
      "Chief complaint: Chronic lower back pain for 6 months, worsens after prolonged sitting. Previous MRI shows L4-L5 disc bulge. Patient prefers morning sessions. Carry resistance band. Allergic to latex gloves.",
    insurance: "HDFC Health – Verified",
    workflowStep: 2,
  },
  {
    id: "appt-2",
    patientId: "p-neha",
    patientName: "Neha Sharma",
    patientAge: 35,
    patientGender: "female",
    patientPhone: "+919812345679",
    time: "12:00",
    timeLabel: "12:00",
    meridiem: "PM",
    type: "clinic",
    status: "confirmed",
    paymentStatus: "paid",
    amount: 800,
    condition: "Post-surgery knee rehab",
    address: "Physiobuddies Clinic, Andheri West",
    latitude: 19.1364,
    longitude: 72.8296,
    distanceKm: 3.1,
    etaMin: 12,
    notes: "6 weeks post ACL reconstruction. Progressing well. Focus on proprioception.",
    workflowStep: 1,
  },
  {
    id: "appt-3",
    patientId: "p-rohan",
    patientName: "Rohan Mehta",
    patientAge: 28,
    patientGender: "male",
    patientPhone: "+919812345680",
    time: "04:00",
    timeLabel: "04:00",
    meridiem: "PM",
    type: "online",
    status: "confirmed",
    paymentStatus: "pending",
    amount: 600,
    condition: "Shoulder impingement",
    notes: "Online consultation. Review exercise progress.",
    workflowStep: 1,
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    patientName: "Amit Verma",
    amount: 1200,
    type: "session",
    status: "paid",
    date: "2026-06-17",
    dateLabel: "Today",
    sessionType: "home",
  },
  {
    id: "tx-2",
    patientName: "Neha Sharma",
    amount: 800,
    type: "session",
    status: "paid",
    date: "2026-06-17",
    dateLabel: "Today",
    sessionType: "clinic",
  },
  {
    id: "tx-3",
    patientName: "Priya Nair",
    amount: 1500,
    type: "session",
    status: "pending",
    date: "2026-06-16",
    dateLabel: "Yesterday",
    sessionType: "home",
  },
  {
    id: "tx-4",
    patientName: "Weekly bonus",
    amount: 2400,
    type: "bonus",
    status: "paid",
    date: "2026-06-15",
    dateLabel: "15 Jun",
  },
  {
    id: "tx-5",
    patientName: "Bank payout",
    amount: 22000,
    type: "payout",
    status: "paid",
    date: "2026-06-09",
    dateLabel: "9 Jun",
  },
];

export const mockEarnings: EarningsSummary = {
  totalThisWeek: 28400,
  changePercent: 12,
  totalThisMonth: 98600,
  pendingPayout: 6300,
  nextPayoutDate: "Mon, 22 Jun 2026",
  weeklyChart: mockDashboardStats.weeklyChart,
};

export const mockNotifications: AppNotification[] = [
  {
    id: "n-1",
    type: "appointment",
    title: "New appointment confirmed",
    body: "Amit Verma — Home visit today at 10:30 AM",
    timestamp: "9:15 AM",
    read: false,
    actionUrl: "/appointment/appt-1",
  },
  {
    id: "n-2",
    type: "payment",
    title: "Payment received",
    body: "Rs 1,200 from Amit Verma has been credited",
    timestamp: "8:42 AM",
    read: false,
  },
  {
    id: "n-3",
    type: "task",
    title: "Treatment note pending",
    body: "Complete Neha's treatment note before 6 PM payout review",
    timestamp: "Yesterday",
    read: true,
    actionUrl: "/treatment",
  },
  {
    id: "n-4",
    type: "system",
    title: "Document re-upload required",
    body: "Your registration certificate was rejected. Please re-upload a clear scan.",
    timestamp: "2 days ago",
    read: true,
  },
];

/**
 * Clinical question catalog for the treatment form. This is the exact shape
 * `GET /treatment/form-config` will return (api_contract.md §6.3) — served by the
 * backend so clinical questions can change without an app release. Until that
 * endpoint exists, this bundled copy is both the mock response and the
 * offline/loading fallback. Content mirrors the design prototype
 * (treatment-form.html) verbatim, including per-finding sub-questions.
 */

// ---------------------------------------------------------------------------
// Payouts / wallet
// ---------------------------------------------------------------------------

export const mockPayouts: Payout[] = [
  {
    id: "payout-3",
    amount: 8400,
    status: "processed",
    transactionRef: "UTR-8891204471",
    requestedAt: "2026-07-20T06:00:00.000Z",
    processedAt: "2026-07-21T09:30:00.000Z",
    dateLabel: "21 Jul",
    account: { upi: "himanshu@okhdfcbank", bankName: "HDFC Bank" },
  },
  {
    id: "payout-2",
    amount: 6250,
    status: "processing",
    requestedAt: "2026-07-26T05:15:00.000Z",
    dateLabel: "26 Jul",
    account: { upi: "himanshu@okhdfcbank", bankName: "HDFC Bank" },
  },
  {
    id: "payout-1",
    amount: 3100,
    status: "requested",
    requestedAt: "2026-07-28T04:00:00.000Z",
    dateLabel: "Today",
    account: { upi: "himanshu@okhdfcbank", bankName: "HDFC Bank" },
  },
];

export const mockWallet: WalletInfo = {
  balance: 12480,
  entries: [
    { id: "w-3", amount: 639, type: "credit", balanceAfter: 12480, createdAt: "2026-07-27T10:00:00.000Z", dateLabel: "Yesterday" },
    { id: "w-2", amount: 799, type: "credit", balanceAfter: 11841, createdAt: "2026-07-25T10:00:00.000Z", dateLabel: "25 Jul" },
    { id: "w-1", amount: -6250, type: "payout", balanceAfter: 11042, createdAt: "2026-07-26T05:15:00.000Z", dateLabel: "26 Jul" },
  ],
};

export const mockReviews: TherapistReview[] = [
  {
    rating: 5,
    comment: "Excellent care, noticeable improvement after a few sessions.",
    reviewerName: "Priya Sharma",
    reviewerImage: null,
    createdAt: "2026-07-22T14:07:58.600Z",
    dateLabel: "22 Jul",
  },
  {
    rating: 4,
    comment: "Very professional and punctual. Explained every exercise clearly.",
    reviewerName: "Rohit Verma",
    reviewerImage: null,
    createdAt: "2026-07-18T09:20:00.000Z",
    dateLabel: "18 Jul",
  },
];

/** Two days of hourly slots, matching the backend's 6am–8pm grid. */
export const mockAvailability: AvailabilityDay[] = [0, 1].map((offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const raw = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  return {
    date: iso,
    rawDate: raw,
    label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
    slots: Array.from({ length: 15 }, (_, i) => {
      const startHour = 6 + i;
      return {
        startHour,
        startTime: startHour * 60,
        endTime: startHour * 60 + 40,
        category: startHour < 12 ? "morning" : startHour < 17 ? "afternoon" : "evening",
        status: offset === 0 && (startHour === 8 || startHour === 14) ? "booked" : "open",
      };
    }),
  };
});

export const mockArticles: TherapistArticle[] = [
  {
    id: "article-1",
    title: "5 safe desk stretches for lower back stiffness",
    content:
      "Sitting for long stretches shortens the hip flexors and loads the lumbar spine. These five stretches take four minutes and can be done at a desk.",
    createdAt: "2026-07-21T08:00:00.000Z",
    dateLabel: "21 Jul",
  },
  {
    id: "article-2",
    title: "ACL rehab milestones after week six",
    content:
      "Week six is where controlled loading begins. Progress is measured by quad activation and single-leg balance, not by pain alone.",
    createdAt: "2026-07-24T08:00:00.000Z",
    dateLabel: "24 Jul",
  },
];

export const mockFaqs: TherapistFaq[] = [
  { id: "faq-1", question: "How many sessions will I need?", answer: "It depends on your condition, typically 6-10 sessions." },
  { id: "faq-2", question: "Do you provide home visits?", answer: "Yes, within a 10 km radius of Pitampura." },
];
