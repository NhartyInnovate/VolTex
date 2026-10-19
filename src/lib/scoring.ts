import { CONFERENCE_CONFIG } from "@/config/constants";
import { ReferralRecord, ScoringConfig, ScoringSummary } from "@/types";

/**
 * Calculates points and carryovers from a count of verified tickets.
 * Official rule: 5 points per verified ticket.
 * Pending and rejected referrals earn zero points.
 */
export function calculatePointsFromTickets(
  verifiedTickets: number,
  config?: Partial<ScoringConfig>
): {
  points: number;
  carryoverTickets: number;
} {
  const safeTickets = Math.max(0, Math.floor(verifiedTickets || 0));

  // If pointsPerTicket is provided (preferred model, default: 5)
  if (config?.pointsPerTicket !== undefined || (!config?.ticketsPerPoint && CONFERENCE_CONFIG.scoring.pointsPerTicket)) {
    const pointsFactor = Math.max(
      1,
      Math.floor(config?.pointsPerTicket ?? CONFERENCE_CONFIG.scoring.pointsPerTicket ?? 5)
    );
    return {
      points: safeTickets * pointsFactor,
      carryoverTickets: 0,
    };
  }

  // Legacy fallback ratio support if an admin sets ticketsPerPoint
  const ratio = Math.max(1, Math.floor(config?.ticketsPerPoint ?? 1));
  const allowCarryover = config?.enableCarryover ?? false;
  const points = Math.floor(safeTickets / ratio);
  const carryoverTickets = allowCarryover ? safeTickets % ratio : 0;

  return {
    points,
    carryoverTickets,
  };
}

/**
 * Aggregates a volunteer's referral submissions into a scoring summary.
 * Only 'approved' referrals count toward points.
 */
export function calculateVolunteerSummary(
  referrals: ReferralRecord[],
  config?: Partial<ScoringConfig>
): ScoringSummary {
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

  const { points, carryoverTickets } = calculatePointsFromTickets(
    approvedTickets,
    config
  );

  return {
    totalSubmittedTickets,
    approvedTickets,
    pendingTickets,
    rejectedTickets,
    points,
    carryoverTickets,
  };
}
