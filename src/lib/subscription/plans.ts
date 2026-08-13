/**
 * Therapist subscription plans — client-defined, mirroring the web frontend
 * (`physiobuddies-frontend/src/pages/Therapist/Subscription`). The backend has no plan catalog
 * endpoint; plans are a product decision that lives in the client until one exists.
 *
 * NOTE: actual in-app billing is gated by `SUBSCRIPTION_PAYMENT_ENABLED` in config — the backend
 * does not yet charge for or activate a subscription (it's created for free during final onboarding,
 * with a `// TODO: payment for subscription`). See progress.md.
 */
export interface SubscriptionPlan {
  id: "3m" | "6m" | "12m";
  name: string;
  months: number;
  /** Total price for the whole term, in INR. */
  price: number;
  /** Rounded per-month cost, for the "≈ ₹X/mo" line. */
  monthlyEquivalent: number;
  savings?: string;
  popular: boolean;
  description: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "3m",
    name: "Quarterly",
    months: 3,
    price: 449,
    monthlyEquivalent: Math.round(449 / 3),
    popular: false,
    description: "Perfect for getting started and experiencing the platform.",
    features: [
      "Verified therapist profile",
      "Real-time appointment booking",
      "Basic patient management",
      "Standard email support",
    ],
  },
  {
    id: "6m",
    name: "Half-Yearly",
    months: 6,
    price: 749,
    monthlyEquivalent: Math.round(749 / 6),
    savings: "Save 16%",
    popular: true,
    description: "Our most popular plan for committed professionals.",
    features: [
      "Everything in Quarterly",
      "Featured profile placement",
      "Advanced analytics dashboard",
      "Priority chat support",
    ],
  },
  {
    id: "12m",
    name: "Annually",
    months: 12,
    price: 1199,
    monthlyEquivalent: Math.round(1199 / 12),
    savings: "Save 33%",
    popular: false,
    description: "Maximum value for long-term growth and practice expansion.",
    features: [
      "Everything in Half-Yearly",
      "Top-tier search ranking",
      "Custom article publishing",
      "24/7 dedicated phone support",
    ],
  },
];
