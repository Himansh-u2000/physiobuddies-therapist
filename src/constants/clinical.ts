import type {
  AssessmentType,
  DurationOfSymptoms,
  FallRisk,
  MuscleStrength,
  RangeOfMotion,
  VisitFrequency,
} from "@/types";

/**
 * Option catalogs for the clinical assessment form.
 *
 * The enum-valued fields (`assessmentType`, `durationOfSymptoms`, `rom`, `muscleStrength`,
 * `visitFrequency`, `fallRisk`) are FIXED by the backend's Prisma schema — an unrecognised value
 * is coerced to a default server-side rather than rejected, so a typo here would silently store
 * the wrong clinical finding. Each list below therefore mirrors `prisma/assessment.prisma`
 * exactly, with a display label attached.
 *
 * The free-text array fields (`chiefComplaint`, `painCharacteristics`, `problemsIdentified`,
 * `functionalLimitations`) are `String[]` server-side with no enum, so these are suggestions
 * that speed up entry — not a closed set. The form lets the therapist add their own.
 */

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Optional second line, used where the clinical shorthand needs expanding. */
  hint?: string;
}

export const ASSESSMENT_TYPES: Option<AssessmentType>[] = [
  { value: "ORTHO", label: "Ortho", hint: "Musculoskeletal" },
  { value: "POST_SURGICAL", label: "Post-surgical", hint: "After an operation" },
  { value: "SPORTS", label: "Sports", hint: "Athletic injury" },
  { value: "NEURO", label: "Neuro", hint: "Neurological" },
  { value: "GERIATRIC", label: "Geriatric", hint: "Older adult" },
  { value: "CARDIOPULMONARY", label: "Cardiopulmonary", hint: "Heart / lungs" },
  { value: "GENERAL", label: "General", hint: "Everything else" },
];

export const DURATIONS: Option<DurationOfSymptoms>[] = [
  { value: "LESS_THAN_ONE_WEEK", label: "< 1 week" },
  { value: "ONE_TO_FOUR_WEEKS", label: "1–4 weeks" },
  { value: "ONE_TO_THREE_MONTHS", label: "1–3 months" },
  { value: "THREE_TO_SIX_MONTHS", label: "3–6 months" },
  { value: "GREATER_THAN_SIX_MONTHS", label: "> 6 months" },
];

export const ROM_OPTIONS: Option<RangeOfMotion>[] = [
  { value: "Full", label: "Full" },
  { value: "Mild_Restriction", label: "Mild" },
  { value: "Moderate_Restriction", label: "Moderate" },
  { value: "Severe_Restriction", label: "Severe" },
];

export const STRENGTH_OPTIONS: Option<MuscleStrength>[] = [
  { value: "Normal", label: "Normal", hint: "5/5" },
  { value: "Mild_Weakness", label: "Mild", hint: "4/5" },
  { value: "Moderate_Weakness", label: "Moderate", hint: "3/5" },
  { value: "Severe_Weakness", label: "Severe", hint: "≤2/5" },
];

export const FALL_RISK_OPTIONS: Option<FallRisk>[] = [
  { value: "Low", label: "Low" },
  { value: "Moderate", label: "Moderate" },
  { value: "High", label: "High" },
];

export const VISIT_FREQUENCIES: Option<VisitFrequency>[] = [
  { value: "Daily", label: "Daily" },
  { value: "Alternate_Days", label: "Alternate days" },
  { value: "Three_Times_Week", label: "3×/week" },
  { value: "Two_Times_Week", label: "2×/week" },
  { value: "Weekly", label: "Weekly" },
];

// --- Free-text suggestion lists (String[] server-side, so these are shortcuts only) ---

export const CHIEF_COMPLAINTS = [
  "Pain",
  "Stiffness",
  "Swelling",
  "Weakness",
  "Numbness",
  "Instability",
  "Reduced mobility",
  "Balance problems",
];

export const PAIN_CHARACTERISTICS = [
  "Sharp",
  "Dull",
  "Burning",
  "Throbbing",
  "Radiating",
  "Constant",
  "Intermittent",
  "Night pain",
];

export const PROBLEMS_IDENTIFIED = [
  "Decreased ROM",
  "Reduced Strength",
  "Muscle spasm",
  "Postural imbalance",
  "Gait deviation",
  "Poor balance",
  "Joint stiffness",
  "Reduced endurance",
];

export const TREATMENT_ITEMS = [
  "Manual Therapy",
  "Therapeutic Exercise",
  "Mobilisation",
  "TENS",
  "Ultrasound",
  "IFT",
  "Dry needling",
  "Taping",
  "Gait training",
  "Balance training",
];

export const FUNCTIONAL_LIMITATIONS = [
  "Stairs",
  "Walking distance",
  "Sit to stand",
  "Overhead reach",
  "Dressing",
  "Driving",
  "Lifting",
  "Sleeping",
];

export const MOBILITY_STATUSES = ["Independent", "Supervision", "Minimal assist", "Dependent"];

export const ASSISTIVE_DEVICES = ["None", "Walker", "Cane", "Crutches", "Wheelchair", "Orthosis"];

/** Which conditional block the backend will actually persist for a given assessment type. */
export function conditionalBlockFor(
  type: AssessmentType,
): "surgical" | "sports" | "neuro" | "cardiopulmonary" | null {
  switch (type) {
    case "POST_SURGICAL":
      return "surgical";
    case "SPORTS":
      return "sports";
    case "NEURO":
      return "neuro";
    case "CARDIOPULMONARY":
      return "cardiopulmonary";
    default:
      // ORTHO, GERIATRIC and GENERAL have no extra block — the backend's mapper writes null
      // for all four composite types, so showing extra fields here would collect data that is
      // then silently discarded.
      return null;
  }
}
