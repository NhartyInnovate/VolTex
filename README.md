# VolTex — TEDxGwarinpa Volunteer Ticket Sales Challenge

VolTex is a modern, responsive web application built for the **TEDxGwarinpa** organizing team and volunteer community. It enables volunteers to champion ticket sales for the conference, submit referral claims, track verified sales, earn recognized points, and compete on a live public leaderboard.

Official Conference Ticket Hub: [https://meeteor.me/clip/join?eventId=DSVXOF](https://meeteor.me/clip/join?eventId=DSVXOF)

---

## 🚀 Live Demo & Status

> **Demo Preview Mode:** This current release runs as a polished, interactive frontend demo with realistic mock datasets. Authentication, referral submissions, duplicate checking, and admin verification actions are simulated in client memory. No live database connection is required to explore all pages and workflows.

- **Public Landing Page:** Overview, conference details, how-it-works, scoring model, and CTA links.
- **Public Leaderboard:** Podium standings (Top 3), team-based filtering, text search, verified ticket counts, and points. Zero private buyer data is exposed.
- **Volunteer Portal (`/dashboard`):** Personal scoring metrics (points, verified tickets, odd carryover), referral reporting modal with duplicate detection, and a ready-to-share outreach kit with one-click WhatsApp sharing.
- **Admin Verification Hub (`/admin`):** Review queue, duplicate purchase alerts, Meeteor reconciliation guide, approval/rejection modal, and live points adjustment.
- **Authentication Screens:** Volunteer registration with centralized team dropdown, sign-in, and password recovery.

---

## 📐 Scoring Model & Integrity Rules

- **1 Point = 2 Verified Paid Tickets:** Points are awarded strictly after administrator verification against official Meeteor Hub records.
- **Odd Ticket Carryover:** If a volunteer has an odd number of verified tickets (e.g., 3 tickets), they receive 1 point, and the remaining 1 ticket carries over toward the next point.
- **Single Crediting Enforcement:** When a reliable purchase identifier (order reference, email, or phone) is provided, the database prevents the same purchase from being approved or credited more than once.
- **Anti-Fraud:** Potential matching buyer names are automatically flagged for organizer review. Volunteers cannot verify or award points to their own submissions.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS with custom TEDx brand tokens (`#EB0028`, dark surfaces, custom glows)
- **Icons:** Lucide React
- **Backend / DB (Prepared):** Supabase (PostgreSQL with Row Level Security, Triggers, Views)
- **Deployment:** Vercel

---

## 💻 Local Development Setup

### Prerequisites
- Node.js `v18.17+` or `v20+` (tested on Node `v24.20.0`)
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/VolTex.git
cd VolTex
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables (Optional for UI demo)
```bash
cp .env.example .env.local
```
*(The UI demo runs with mock data out of the box without requiring live Supabase credentials).*

### 4. Run automated test suite
```bash
node scripts/verify-rules.mjs
```

### 5. Start development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Production build check
```bash
npm run lint
npm run build
```

---

## 🔒 Security Architecture (Prepared for Live Integration)

The database schema and security policies are fully designed in `supabase/migrations/20261017000001_initial_schema.sql`:
- **Strict Profile Isolation:** Volunteers can only read and update their own private profile (`phone_number` is never exposed publicly).
- **Guaranteed Volunteer Role:** Public registrations are processed through a `SECURITY DEFINER` trigger on `auth.users`, preventing client-side role tampering.
- **Partial Unique Index:** Enforces single crediting on approved purchase identifiers.
- **Immutable Audit Trail:** All status updates are automatically recorded by a database trigger into `audit_logs` with `UPDATE` and `DELETE` revoked.
- **Protected Admin Bootstrap:** Admin elevation can only be performed via internal service-role SQL execution.

---

## 📄 License & Compliance

This independent TEDx event is operated under license from TED. All trademarks belong to their respective owners.
