"use client";

import React, { useState, useMemo } from "react";
import { LeaderboardEntry } from "@/types";
import { VOLUNTEER_TEAMS } from "@/config/constants";
import { Trophy, Medal, Search, Filter, Sparkles, CheckCircle2 } from "lucide-react";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  showPodium?: boolean;
}

export function LeaderboardTable({ entries, showPodium = true }: LeaderboardTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const matchesSearch =
        item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.volunteerTeam.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam =
        selectedTeam === "all" || item.volunteerTeam === selectedTeam;
      return matchesSearch && matchesTeam;
    });
  }, [entries, searchQuery, selectedTeam]);

  // Podium top 3 (from unfiltered list or filtered)
  const topThree = useMemo(() => {
    return entries.slice(0, 3);
  }, [entries]);

  return (
    <div className="space-y-8">
      {/* Top 3 Visual Podium (only when showPodium is enabled) */}
      {showPodium && entries.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Rank 2 (Silver) */}
          <div className="order-2 md:order-1 tedx-surface rounded-2xl p-6 text-center border-zinc-800 flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-400/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-300 font-black text-lg mb-3 shadow-sm">
                2
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700 mb-2">
                Silver Contender
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-zinc-200">
                {topThree[1].fullName}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                {topThree[1].volunteerTeam}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-around">
              <div>
                <span className="block text-2xl font-black text-white">
                  {topThree[1].points}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Points
                </span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <span className="block text-2xl font-black text-zinc-300">
                  {topThree[1].verifiedTickets}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Tickets
                </span>
              </div>
            </div>
          </div>

          {/* Rank 1 (Gold) */}
          <div className="order-1 md:order-2 tedx-surface rounded-2xl p-6 text-center border-tedx-red/40 bg-gradient-to-b from-tedx-red/10 via-zinc-900 to-zinc-950 flex flex-col justify-between relative overflow-hidden shadow-tedx group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-tedx-red/15 rounded-full blur-3xl pointer-events-none" />
            <div>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-tedx-red text-white font-black text-xl mb-3 shadow-lg shadow-tedx-red/40 ring-4 ring-tedx-red/20">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="inline-block px-3 py-0.5 rounded-full text-xs font-bold bg-tedx-red text-white shadow-sm mb-2">
                Leader (#1 Champion)
              </div>
              <h3 className="text-xl font-extrabold text-white">
                {topThree[0].fullName}
              </h3>
              <p className="text-xs text-zinc-300 mt-1 line-clamp-1">
                {topThree[0].volunteerTeam}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-tedx-red/20 flex items-center justify-around">
              <div>
                <span className="block text-3xl font-black text-tedx-lightred">
                  {topThree[0].points}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                  Points
                </span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <span className="block text-3xl font-black text-white">
                  {topThree[0].verifiedTickets}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Tickets
                </span>
              </div>
            </div>
          </div>

          {/* Rank 3 (Bronze) */}
          <div className="order-3 md:order-3 tedx-surface rounded-2xl p-6 text-center border-zinc-800 flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 border border-amber-800/60 text-amber-500 font-black text-lg mb-3 shadow-sm">
                3
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/40 text-amber-400 border border-amber-800/40 mb-2">
                Bronze Contender
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-zinc-200">
                {topThree[2].fullName}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                {topThree[2].volunteerTeam}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-around">
              <div>
                <span className="block text-2xl font-black text-white">
                  {topThree[2].points}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Points
                </span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <span className="block text-2xl font-black text-zinc-300">
                  {topThree[2].verifiedTickets}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Tickets
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="tedx-surface rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-zinc-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search volunteer or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full sm:w-auto bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-tedx-red transition-colors"
          >
            <option value="all">All Volunteer Teams</option>
            {VOLUNTEER_TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="tedx-surface rounded-2xl border-zinc-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[11px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4 sm:px-6 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4 sm:px-6">Volunteer</th>
                <th className="py-3.5 px-4 sm:px-6 hidden sm:table-cell">Team</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">Verified Tickets</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500 text-sm">
                    No volunteers found matching your query.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row) => (
                  <tr
                    key={row.volunteerId}
                    className="hover:bg-zinc-900/50 transition-colors"
                  >
                    {/* Rank Badge */}
                    <td className="py-4 px-4 sm:px-6 text-center">
                      {row.rank === 1 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-tedx-red text-white text-xs font-black shadow-tedx">
                          1
                        </span>
                      )}
                      {row.rank === 2 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-700 text-zinc-200 text-xs font-black">
                          2
                        </span>
                      )}
                      {row.rank === 3 && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-900/60 border border-amber-700/60 text-amber-400 text-xs font-black">
                          3
                        </span>
                      )}
                      {row.rank > 3 && (
                        <span className="text-zinc-500 font-semibold text-xs">
                          #{row.rank}
                        </span>
                      )}
                    </td>

                    {/* Volunteer Name */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-semibold text-white flex items-center gap-2">
                        {row.fullName}
                        {row.rank === 1 && (
                          <Sparkles className="w-3.5 h-3.5 text-tedx-red" />
                        )}
                      </div>
                      <div className="sm:hidden text-xs text-zinc-500 mt-0.5">
                        {row.volunteerTeam}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="py-4 px-4 sm:px-6 hidden sm:table-cell">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 text-zinc-300 border border-zinc-800">
                        {row.volunteerTeam}
                      </span>
                    </td>

                    {/* Verified Tickets */}
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-zinc-200 bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {row.verifiedTickets}
                      </span>
                      {row.carryoverTickets > 0 && (
                        <span className="block text-[10px] text-zinc-500 mt-1 font-mono">
                          +{row.carryoverTickets} odd carryover
                        </span>
                      )}
                    </td>

                    {/* Points */}
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <span className="text-base font-black text-tedx-red font-mono">
                        {row.points} <span className="text-xs text-zinc-400">pts</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            Leaderboard updates automatically when referral claims are approved by event admins.
          </span>
          <span className="text-zinc-400 font-medium">
            1 Point = 2 Verified Tickets
          </span>
        </div>
      </div>
    </div>
  );
}
