"use client";

import React, { useState, useMemo } from "react";
import { LeaderboardEntry } from "@/types";
import { VOLUNTEER_TEAMS, getSafeVolunteerTeam } from "@/config/constants";
import { Search } from "lucide-react";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isDemoData?: boolean;
}

export function LeaderboardTable({ entries, isDemoData = true }: LeaderboardTableProps) {
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

  return (
    <div className="space-y-4">
      {/* Search and Team Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by name or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111114] border border-zinc-800 rounded px-8 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-[#111114] border border-zinc-800 rounded px-3 py-2 text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors w-full sm:w-auto"
          >
            <option value="all">All Teams</option>
            {VOLUNTEER_TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="border border-zinc-800/80 rounded bg-[#111114] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-[#0e0e11]">
                <th className="py-3 px-4 w-14 text-center">Rank</th>
                <th className="py-3 px-4">Volunteer</th>
                <th className="py-3 px-4 hidden sm:table-cell">Team</th>
                <th className="py-3 px-4 text-center">Verified Tickets</th>
                <th className="py-3 px-4 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    No volunteers found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row) => (
                  <tr
                    key={row.volunteerId}
                    className="hover:bg-zinc-800/30 transition-colors duration-150"
                  >
                    {/* Rank */}
                    <td className="py-3 px-4 text-center font-mono font-medium">
                      {row.rank === 1 ? (
                        <span className="text-tedx-red font-bold">1</span>
                      ) : (
                        <span className="text-zinc-400">{row.rank}</span>
                      )}
                    </td>

                    {/* Volunteer */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-100">
                        {row.fullName}
                      </div>
                      <div className="sm:hidden text-[11px] text-zinc-500 mt-0.5">
                        {getSafeVolunteerTeam(row.volunteerTeam)}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="py-3 px-4 hidden sm:table-cell text-zinc-400">
                      {getSafeVolunteerTeam(row.volunteerTeam)}
                    </td>

                    {/* Verified Tickets */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="text-zinc-200">{row.verifiedTickets}</span>
                      {row.carryoverTickets > 0 && (
                        <span className="text-[10px] text-zinc-500 ml-1.5">
                          (+{row.carryoverTickets} carryover)
                        </span>
                      )}
                    </td>

                    {/* Points */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-100">
                      {row.points} <span className="text-[10px] font-normal text-zinc-500">pts</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="px-4 py-2.5 border-t border-zinc-800/80 bg-[#0e0e11] text-[11px] text-zinc-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
          <span>
            {isDemoData ? "Sample preview data. " : ""}
            Rankings update automatically upon admin verification against Meeteor Hub.
          </span>
          <span className="text-zinc-400">Scoring policy: 5 pts per verified ticket</span>
        </div>
      </div>
    </div>
  );
}
