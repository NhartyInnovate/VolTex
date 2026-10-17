/**
 * ==============================================================================
 * MOCK DATA FOR UI PREVIEW & DEVELOPMENT CHECKPOINTS
 * ==============================================================================
 * This file contains strictly realistic mock data to render the volunteer and
 * admin UI workflows before live Supabase connections are activated.
 * In Phase 4 & Phase 5, these will be replaced with real Supabase queries.
 */

import { LeaderboardEntry, ReferralRecord, UserProfile } from "@/types";

export const IS_MOCK_DATA = true;

export const MOCK_VOLUNTEER_USER: UserProfile = {
  id: "vol-001-amina",
  email: "amina.bello@tedxgwarinpa.org",
  fullName: "Amina Bello",
  phoneNumber: "+234 803 123 4567",
  volunteerTeam: "Media, Comms & Marketing",
  role: "volunteer",
  createdAt: "2026-09-01T10:00:00Z",
};

export const MOCK_ADMIN_USER: UserProfile = {
  id: "admin-001-chidi",
  email: "lead.admin@tedxgwarinpa.org",
  fullName: "Chidi Nnamdi",
  phoneNumber: "+234 809 987 6543",
  volunteerTeam: "Technical, Stage & Production",
  role: "admin",
  createdAt: "2026-08-15T09:00:00Z",
};

export const MOCK_VOLUNTEER_REFERRALS: ReferralRecord[] = [
  {
    id: "ref-101",
    volunteerId: "vol-001-amina",
    volunteerName: "Amina Bello",
    volunteerTeam: "Media, Comms & Marketing",
    buyerName: "Oluwaseun Adeleke",
    ticketType: "VIP Experience",
    ticketQuantity: 2,
    buyerIdentifier: "MTR-VIP-88902",
    status: "approved",
    adminNotes: "Verified against Meeteor Hub transaction #88902",
    flaggedDuplicate: false,
    verifiedAt: "2026-10-12T14:30:00Z",
    verifiedBy: "Chidi Nnamdi",
    createdAt: "2026-10-12T11:20:00Z",
  },
  {
    id: "ref-102",
    volunteerId: "vol-001-amina",
    volunteerName: "Amina Bello",
    volunteerTeam: "Media, Comms & Marketing",
    buyerName: "Fatima Ibrahim",
    ticketType: "Standard Delegate",
    ticketQuantity: 1,
    buyerIdentifier: "fatima.ibrahim@fintech.ng",
    status: "approved",
    adminNotes: "Matched buyer email in attendee list",
    flaggedDuplicate: false,
    verifiedAt: "2026-10-14T09:15:00Z",
    verifiedBy: "Chidi Nnamdi",
    createdAt: "2026-10-13T16:45:00Z",
  },
  {
    id: "ref-103",
    volunteerId: "vol-001-amina",
    volunteerName: "Amina Bello",
    volunteerTeam: "Media, Comms & Marketing",
    buyerName: "Emeka Okafor",
    ticketType: "Standard Delegate",
    ticketQuantity: 2,
    buyerIdentifier: "MTR-STD-99014",
    status: "pending",
    flaggedDuplicate: false,
    createdAt: "2026-10-16T18:10:00Z",
  },
  {
    id: "ref-104",
    volunteerId: "vol-001-amina",
    volunteerName: "Amina Bello",
    volunteerTeam: "Media, Comms & Marketing",
    buyerName: "Zainab Mohammed",
    ticketType: "Student Pass (Discounted)",
    ticketQuantity: 1,
    buyerIdentifier: "zainab.m@students.abu.edu",
    status: "pending",
    flaggedDuplicate: true,
    duplicateSourceId: "ref-088",
    adminNotes: "Duplicate identifier flagged: Also submitted by volunteer Tunde Bakare",
    createdAt: "2026-10-17T08:30:00Z",
  },
  {
    id: "ref-105",
    volunteerId: "vol-001-amina",
    volunteerName: "Amina Bello",
    volunteerTeam: "Media, Comms & Marketing",
    buyerName: "Kelechi Umeh",
    ticketType: "Standard Delegate",
    ticketQuantity: 1,
    buyerIdentifier: "+2348030009988",
    status: "rejected",
    adminNotes: "Ticket was refunded on Meeteor prior to verification",
    flaggedDuplicate: false,
    verifiedAt: "2026-10-15T12:00:00Z",
    verifiedBy: "Chidi Nnamdi",
    createdAt: "2026-10-14T20:10:00Z",
  },
];

export const MOCK_ADMIN_ALL_REFERRALS: ReferralRecord[] = [
  ...MOCK_VOLUNTEER_REFERRALS,
  {
    id: "ref-088",
    volunteerId: "vol-002-tunde",
    volunteerName: "Tunde Bakare",
    volunteerTeam: "Logistics & Operations",
    buyerName: "Zainab Mohammed",
    ticketType: "Student Pass (Discounted)",
    ticketQuantity: 1,
    buyerIdentifier: "zainab.m@students.abu.edu",
    status: "pending",
    flaggedDuplicate: true,
    createdAt: "2026-10-16T22:00:00Z",
  },
  {
    id: "ref-089",
    volunteerId: "vol-003-ngozi",
    volunteerName: "Ngozi Eze",
    volunteerTeam: "Sponsorship & Partnerships",
    buyerName: "Apex Capital Ventures (Group of 6)",
    ticketType: "Executive / Patron",
    ticketQuantity: 6,
    buyerIdentifier: "APEX-MTR-CORP-44",
    status: "pending",
    flaggedDuplicate: false,
    createdAt: "2026-10-17T09:40:00Z",
  },
  {
    id: "ref-090",
    volunteerId: "vol-004-danladi",
    volunteerName: "Danladi Musa",
    volunteerTeam: "Guest Experience & Protocol",
    buyerName: "Dr. Aliyu Garba",
    ticketType: "VIP Experience",
    ticketQuantity: 2,
    buyerIdentifier: "MTR-VIP-11203",
    status: "approved",
    adminNotes: "Confirmed in Meeteor VIP roster",
    flaggedDuplicate: false,
    verifiedAt: "2026-10-16T15:00:00Z",
    verifiedBy: "Chidi Nnamdi",
    createdAt: "2026-10-16T11:00:00Z",
  },
];

export const MOCK_PUBLIC_LEADERBOARD: LeaderboardEntry[] = [
  {
    volunteerId: "vol-003-ngozi",
    fullName: "Ngozi Eze",
    volunteerTeam: "Sponsorship & Partnerships",
    verifiedTickets: 14,
    points: 7, // 14 / 2 = 7 pts
    carryoverTickets: 0,
    rank: 1,
  },
  {
    volunteerId: "vol-002-tunde",
    fullName: "Tunde Bakare",
    volunteerTeam: "Logistics & Operations",
    verifiedTickets: 11,
    points: 5, // 11 / 2 = 5 pts, 1 carryover
    carryoverTickets: 1,
    rank: 2,
  },
  {
    volunteerId: "vol-004-danladi",
    fullName: "Danladi Musa",
    volunteerTeam: "Guest Experience & Protocol",
    verifiedTickets: 8,
    points: 4, // 8 / 2 = 4 pts
    carryoverTickets: 0,
    rank: 3,
  },
  {
    volunteerId: "vol-005-chioma",
    fullName: "Chioma Okoli",
    volunteerTeam: "Speaker Relations & Curation",
    verifiedTickets: 7,
    points: 3, // 7 / 2 = 3 pts, 1 carryover
    carryoverTickets: 1,
    rank: 4,
  },
  {
    volunteerId: "vol-001-amina",
    fullName: "Amina Bello",
    volunteerTeam: "Media, Comms & Marketing",
    verifiedTickets: 3,
    points: 1, // 3 / 2 = 1 pt, 1 carryover
    carryoverTickets: 1,
    rank: 5,
  },
  {
    volunteerId: "vol-006-ibrahim",
    fullName: "Ibrahim Sanusi",
    volunteerTeam: "Technical, Stage & Production",
    verifiedTickets: 2,
    points: 1,
    carryoverTickets: 0,
    rank: 6,
  },
  {
    volunteerId: "vol-007-folake",
    fullName: "Folake Adeyemi",
    volunteerTeam: "Design & Brand Identity",
    verifiedTickets: 1,
    points: 0, // 1 / 2 = 0 pts, 1 carryover
    carryoverTickets: 1,
    rank: 7,
  },
  {
    volunteerId: "vol-008-uchenna",
    fullName: "Uchenna Nwosu",
    volunteerTeam: "General Volunteer Pool",
    verifiedTickets: 0,
    points: 0,
    carryoverTickets: 0,
    rank: 8,
  },
];
