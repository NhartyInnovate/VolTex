import { VolunteerTeam, TicketType } from "@/config/constants";

export type UserRole = "volunteer" | "admin";

export type ReferralStatus = "pending" | "approved" | "rejected";

export type ScoringPolicyStatus = "draft" | "active" | "archived";

export interface ScoringConfig {
  id: string;
  pointsPerTicket: number;
  ticketsPerPoint?: number;
  enableCarryover?: boolean;
  status: ScoringPolicyStatus;
  label?: string;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  volunteerTeam: VolunteerTeam | string;
  role: UserRole;
  referralCode?: string;
  createdAt: string;
}

export interface AdminManagedUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  volunteerTeam: string;
  role: UserRole;
  createdAt: string;
  referralCount: number;
  approvedTickets: number;
}


export interface ReferralRecord {
  id: string;
  volunteerId: string;
  volunteerName?: string;
  volunteerTeam?: string;
  buyerName: string;
  ticketType: TicketType | string;
  ticketQuantity: number;
  buyerIdentifier?: string; // Order ref, phone, or email (legacy)
  orderReference?: string;
  buyerEmail?: string;
  status: ReferralStatus;
  adminNotes?: string;
  flaggedDuplicate: boolean;
  duplicateReason?: string;
  duplicateSourceId?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  volunteerId: string;
  fullName: string;
  volunteerTeam: string;
  verifiedTickets: number;
  points: number;
  carryoverTickets: number;
  rank: number;
}

export interface ScoringSummary {
  totalSubmittedTickets: number;
  approvedTickets: number;
  pendingTickets: number;
  rejectedTickets: number;
  points: number;
  carryoverTickets: number;
}

export type NotificationType =
  | "new_referral"
  | "referral_approved"
  | "referral_rejected"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string | null;
  metadata?: Record<string, unknown>;
  deduplicationKey: string;
  isRead: boolean;
  createdAt: string;
}


export interface BuyerReferralLead {
  id: string;
  volunteerId: string;
  referralCode: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  ticketQuantity: number;
  sourceAttribution?: string | null;
  status: "pending_purchase" | "converted" | "expired";
  conversionCount: number;
  firstConvertedAt?: string | null;
  lastConvertedAt?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerReferralTouch {
  id: string;
  buyerReferralId: string;
  subsequentVolunteerId: string;
  referralCode: string;
  sourceAttribution?: string | null;
  createdAt: string;
}

export interface LeadClaimConversion {
  id: string;
  buyerReferralId: string;
  referralId: string;
  originalClaimantId: string;
  creditedVolunteerId: string;
  attributionResolution: "match" | "award_to_referrer" | "award_to_claimant";
  emailOverrideApplied: boolean;
  adminNotes?: string | null;
  convertedBy?: string | null;
  convertedAt: string;
}

export interface VolunteerReferralStats {
  allTimeVerifiedTickets: number;
  allTimeOfficialPoints: number;
  filteredVerifiedTickets: number;
  filteredOfficialPoints: number;
  totalRawRequests: number;
  totalTrackedVisits: number;
  totalUniqueVisitorDays: number;
  periodLeadsCaptured: number;
  periodLeadsConverted: number;
  periodLeadApprovedClaims: number;
  periodLeadVerifiedTickets: number;
  cohortLeadsCaptured: number;
  cohortLeadsConverted: number;
  cohortLeadApprovedClaims: number;
  cohortLeadVerifiedTickets: number;
  cohortConversionRate: number;
  cohortTicketsPerLead: number;
}
