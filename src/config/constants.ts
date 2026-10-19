/**
 * Central Configuration for TEDxGwarinpa Volunteer Ticket Challenge
 * All challenge rules, team lists, ticket URLs, and promotional assets are maintained here.
 */

export const CONFERENCE_CONFIG = {
  name: "TEDxGwarinpa",
  edition: "2026 Edition",
  theme: "Ideas Worth Spreading",
  ticketUrl:
    process.env.NEXT_PUBLIC_TICKET_URL ||
    "https://meeteor.me/clip/join?eventId=DSVXOF",
  scoring: {
    pointsPerTicket: 5,
  },
} as const;

/**
 * Centrally configured volunteer teams.
 * Reflects actual confirmed TEDxGwarinpa community teams plus Website Team.
 */
export const VOLUNTEER_TEAMS = [
  "Protocol/Ushering/Logistics Team",
  "TEDxGwarinpa Prayer Team",
  "Volunteer Management Team",
  "Health and Welfare Team",
  "Photography and Videography Team",
  "Curation/Programs Team",
  "Sponsorship and Partnership Team",
  "TEDxGwarinpa Novelty Match ⚽",
  "Public Relation (PR) Team",
  "Technical/Sound Team",
  "Website Team",
] as const;

export type VolunteerTeam = (typeof VOLUNTEER_TEAMS)[number];

/**
 * Safe fallback helper if an existing profile's team was archived or is unavailable.
 */
export function getSafeVolunteerTeam(team?: string | null): string {
  if (!team || typeof team !== "string" || !team.trim()) {
    return "Volunteer Management Team";
  }
  return team.trim();
}

/**
 * Scoring configuration.
 * Default official rule: 5 points awarded per verified ticket.
 * Configurable by admins with full database-level verification.
 */
export const DEFAULT_SCORING_CONFIG = {
  id: "official-config-01",
  pointsPerTicket: 5,
  status: "active" as "draft" | "active" | "archived",
  label: "Official Scoring Policy (5 Points per Verified Ticket)",
  notes: "5 points awarded strictly upon admin verification of each ticket on Meeteor Hub.",
  updatedAt: "2026-10-19T10:00:00Z",
  updatedBy: "Organizing Committee",
};

export const TICKET_TYPES = [
  "Standard Delegate",
  "VIP Experience",
  "Student Pass (Discounted)",
  "Executive / Patron",
] as const;

export type TicketType = (typeof TICKET_TYPES)[number];

/**
 * Pre-written promotional messages for volunteers to share with their network
 */
export const PROMOTIONAL_TEMPLATES = [
  {
    id: "whatsapp-direct",
    channel: "WhatsApp Direct Message",
    title: "Personal Invitation to Friends & Colleagues",
    content: (name: string, url: string) =>
      `Hey there! I am volunteering with the TEDxGwarinpa team. We are hosting an incredible gathering of thinkers, innovators, and changemakers. Tickets are moving fast, and I'd love to see you there! Get yours directly via my link: ${url}. Once you reserve, let me know so I can ensure you're well taken care of! — ${name}`,
  },
  {
    id: "whatsapp-group",
    channel: "WhatsApp Groups / Broadcasts",
    title: "Community & Network Broadcast",
    content: (_name: string, url: string) =>
      `Join us at TEDxGwarinpa! Step into a room filled with transformative ideas, world-class speakers, and high-impact networking. Secure your official delegate ticket now on Meeteor: ${url} 🚀 Seats are limited!`,
  },
  {
    id: "social-caption",
    channel: "Instagram / LinkedIn Caption",
    title: "Social Media Post & Bio Link",
    content: (_name: string, url: string) =>
      `Excited to be part of the volunteer team bringing TEDxGwarinpa to life! 🎤 Are you ready for an unforgettable day of inspiring talks and fresh perspectives? Grab your ticket now before prices increase: ${url} #TEDxGwarinpa #IdeasWorthSpreading #AbujaEvents`,
  },
  {
    id: "quick-pitch",
    channel: "Quick SMS / Chat Pitch",
    title: "Short & Punchy Pitch",
    content: (_name: string, url: string) =>
      `Hey! Grab your TEDxGwarinpa ticket here before it sells out: ${url}. See you on conference day!`,
  },
];
