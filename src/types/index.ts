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
  createdAt: string;
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
