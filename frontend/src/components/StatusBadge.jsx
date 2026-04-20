import { STATUS_LABELS } from "../lib/invoices";

const toneMap = {
  new: "secondary",
  draft: "secondary",
  needs_review: "warning",
  pending: "warning",
  pending_approval: "warning",
  upcoming: "secondary",
  in_review: "info",
  approved: "success",
  ready_for_payment: "info",
  payment_submitted: "warning",
  payment_failed: "danger",
  rejected: "danger",
  sent_back: "secondary",
  cancelled: "secondary",
  scheduled: "info",
  paid: "primary",
  on_hold: "dark",
  duplicate: "danger"
};

function StatusBadge({ status }) {
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";
  const label =
    STATUS_LABELS[normalizedStatus] ||
    status
      ?.split?.("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ") ||
    "Unknown";

  return <span className={`badge text-bg-${toneMap[normalizedStatus] || "secondary"}`}>{label}</span>;
}

export default StatusBadge;
