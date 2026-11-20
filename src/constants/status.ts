export const NEWS_CATEGORIES: Record<string, string> = {
  general: "General News",
  announcement: "Association Announcement",
  government: "Government Update",
  welfare: "Welfare News",
  membership: "Membership Update",
  important: "Important Notice",
  emergency: "Emergency Announcement",
};

export const EVENT_CATEGORIES: Record<string, string> = {
  meeting: "Association Meeting",
  training: "Training",
  camp: "Welfare Camp",
  other: "Other",
};

export const ORDER_STATUSES = [
  "pending",
  "payment_pending",
  "paid",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
] as const;

export const WELFARE_STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  more_info: "More Information Required",
  recommended: "Recommended",
  approved: "Approved",
  rejected: "Rejected",
  payment_pending: "Payment Pending",
  disbursed: "Disbursed",
  closed: "Closed",
};

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const EXPENSE_CATEGORIES = ["Office", "Events", "Travel", "Printing", "Salaries", "Utilities", "Other"];

export function label(s: string | null | undefined) {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const GREEN = "bg-green-100 text-green-800 border-green-200";
const AMBER = "bg-amber-100 text-amber-800 border-amber-200";
const RED = "bg-red-100 text-red-800 border-red-200";
const BLUE = "bg-blue-100 text-blue-800 border-blue-200";
const PURPLE = "bg-purple-100 text-purple-800 border-purple-200";
const GREY = "bg-slate-100 text-slate-700 border-slate-200";

export function statusTone(s: string) {
  switch (s) {
    case "active":
    case "paid":
    case "delivered":
    case "approved":
    case "verified":
    case "disbursed":
    case "published":
    case "resolved":
    case "answered":
    case "recommended":
    case "delivered_ok":
      return GREEN;
    case "pending":
    case "payment_pending":
    case "submitted":
    case "processing":
    case "created":
    case "open":
    case "more_info":
    case "return_requested":
    case "draft":
    case "invited":
      return AMBER;
    case "under_review":
    case "shipped":
    case "out_for_delivery":
    case "acknowledged":
    case "responding":
    case "packed":
      return BLUE;
    case "confirmed":
      return PURPLE;
    case "rejected":
    case "suspended":
    case "cancelled":
    case "failed":
    case "expired":
    case "unpublished":
      return RED;
    default:
      return GREY;
  }
}
