import { CONFERENCE_CONFIG } from "@/config/constants";
import { ReferralRecord, ScoringSummary } from "@/types";

/**
 * Calculates points and carryovers from a count of verified tickets.
 * Scoring Rule: 1 point per 2 verified tickets.
 * Carryover: remaining odd ticket carried over towards the next point.
 */
export function calculatePointsFromTickets(verifiedTickets: number): {
  points: number;
  carryoverTickets: number;
} {
  const safeTickets = Math.max(0, Math.floor(verifiedTickets || 0));
  const ratio = CONFERENCE_CONFIG.scoring.ticketsPerPoint; // default: 2
  const points = Math.floor(safeTickets / ratio);
  const carryoverTickets = safeTickets % ratio;

  return {
    points,
    carryoverTickets,
  };
}

/**
 * Aggregates a volunteer's referral submissions into a scoring summary.
 * Only 'approved' referrals count toward points.
 */
export function calculateVolunteerSummary(referrals: ReferralRecord[]): ScoringSummary {
  let approvedTickets = 0;
  let pendingTickets = 0;
  let rejectedTickets = 0;
  let totalSubmittedTickets = 0;

  for (const item of referrals) {
    const qty = Math.max(1, item.ticketQuantity || 1);
    totalSubmittedTickets += qty;

    if (item.status === "approved") {
      approvedTickets += qty;
    } else if (item.status === "pending") {
      pendingTickets += qty;
    } else if (item.status === "rejected") {
      rejectedTickets += qty;
    }
  }

  const { points, carryoverTickets } = calculatePointsFromTickets(approvedTickets);

  return {
    totalSubmittedTickets,
    approvedTickets,
    pendingTickets,
    rejectedTickets,
    points,
    carryoverTickets,
  };
}
