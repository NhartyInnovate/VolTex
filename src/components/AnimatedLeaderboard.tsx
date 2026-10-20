"use client";

import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { LeaderboardEntry } from "@/types";
import { VOLUNTEER_TEAMS, getSafeVolunteerTeam } from "@/config/constants";
import {
  Search,
  Trophy,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Shuffle,
} from "lucide-react";

interface AnimatedLeaderboardProps {
  entries: LeaderboardEntry[];
  isDemoData?: boolean;
  scoringMultiplier?: number;
  enableSimulation?: boolean; // For landing page preview simulation
}

export function AnimatedLeaderboard({
  entries: initialEntries,
  isDemoData = false,
  scoringMultiplier = 5,
  enableSimulation = false,
}: AnimatedLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map());
  const [isSimulating, setIsSimulating] = useState(false);
  const [recentShiftIds, setRecentShiftIds] = useState<Set<string>>(new Set());

  // FLIP animation refs: store previous DOM positions of tiles
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<string, number>>(new Map());

  // Sync entries when prop changes
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  // Record positions of all visible tiles before state changes or DOM updates
  const capturePositions = () => {
    const positions = new Map<string, number>();
    tileRefs.current.forEach((el, id) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        positions.set(id, rect.top);
      }
    });
    prevPositions.current = positions;
  };

  // FLIP: Play animation after DOM render if positions moved
  useLayoutEffect(() => {
    if (prevPositions.current.size === 0) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      prevPositions.current.clear();
      return;
    }

    tileRefs.current.forEach((el, id) => {
      if (!el) return;
      const oldTop = prevPositions.current.get(id);
      if (oldTop !== undefined) {
        const newTop = el.getBoundingClientRect().top;
        const deltaY = oldTop - newTop;

        if (Math.abs(deltaY) > 1) {
          // Invert: position element back to where it came from
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.transition = "transform 0s";
          el.style.zIndex = Math.abs(deltaY) > 10 ? "10" : "1";

          // Play: animate smoothly to 0
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = "transform 480ms cubic-bezier(0.2, 0.9, 0.3, 1)";
              el.style.transform = "";

              const handleEnd = () => {
                el.style.zIndex = "";
                el.style.transition = "";
                el.removeEventListener("transitionend", handleEnd);
              };
              el.addEventListener("transitionend", handleEnd);
            });
          });
        }
      }
    });

    prevPositions.current.clear();
  }, [entries]);

  // Tasteful demo ranking simulation: occasionally swaps or shifts positions
  const simulatePositionChange = () => {
    if (!isDemoData || entries.length < 2) return;

    // Capture FLIP layout positions right before re-ordering
    capturePositions();

    // Record previous ranks before swapping
    const prevMap = new Map<string, number>();
    entries.forEach((e) => prevMap.set(e.volunteerId, e.rank));
    setPreviousRanks(prevMap);

    // Pick two adjacent positions to swap
    const shuffled = [...entries];
    const idxA = Math.floor(Math.random() * Math.min(4, shuffled.length - 1));
    const idxB = idxA + 1;

    const shiftedSet = new Set<string>([
      shuffled[idxA].volunteerId,
      shuffled[idxB].volunteerId,
    ]);
    setRecentShiftIds(shiftedSet);

    // Increment tickets slightly on the lower one to overtake
    shuffled[idxB] = {
      ...shuffled[idxB],
      verifiedTickets: shuffled[idxA].verifiedTickets + 1,
      points: (shuffled[idxA].verifiedTickets + 1) * scoringMultiplier,
    };

    // Re-sort and re-rank
    shuffled.sort((a, b) => b.points - a.points);
    const reRanked = shuffled.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    setEntries(reRanked);
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setRecentShiftIds(new Set());
    }, 900);
  };

  // Filtered entries based on search & team
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.fullName.toLowerCase().includes(q) ||
        item.volunteerTeam.toLowerCase().includes(q);
      const matchesTeam =
        selectedTeam === "all" || item.volunteerTeam === selectedTeam;
      return matchesSearch && matchesTeam;
    });
  }, [entries, searchQuery, selectedTeam]);

  // Rank movement badge
  const getRankMovement = (volunteerId: string, currentRank: number) => {
    if (!previousRanks.has(volunteerId)) return null;
    const prev = previousRanks.get(volunteerId)!;
    const diff = prev - currentRank; // positive means moved up

    if (diff > 0) {
      return (
        <span className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/60 transition-transform animate-subtle-fade-up">
          <ArrowUp className="w-2.5 h-2.5" />+{diff}
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800/60 transition-transform animate-subtle-fade-up">
          <ArrowDown className="w-2.5 h-2.5" />{diff}
        </span>
      );
    }
    return (
      <span className="flex items-center text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
        <Minus className="w-2.5 h-2.5" />
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Optional Demo Simulation Control */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by volunteer or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded px-8 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors shadow-xs"
          />
        </div>

        <div className="flex flex-wrap xs:flex-nowrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors text-xs flex-1 min-w-0 sm:flex-initial shadow-xs"
          >
            <option value="all">All Teams</option>
            {VOLUNTEER_TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          {isDemoData && enableSimulation && (
            <button
              type="button"
              onClick={simulatePositionChange}
              disabled={isSimulating}
              className="px-3 py-2 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 active:scale-95 transition-all text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 shadow-xs focus:outline-none focus:ring-1 focus:ring-tedx-red"
              title="Simulate dynamic ranking update with live animation"
            >
              <Shuffle className={`w-3.5 h-3.5 ${isSimulating ? "animate-spin text-tedx-red" : ""}`} />
              <span>Simulate Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Animated Ranking Tiles Grid */}
      <div className="grid grid-cols-1 gap-2.5 relative">
        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-[#111114]/50">
            No rankings found matching your filter.
          </div>
        ) : (
          filteredEntries.map((row) => {
            const isTop1 = row.rank === 1;
            const isTop2 = row.rank === 2;
            const isTop3 = row.rank === 3;
            const isRecentlyShifted = recentShiftIds.has(row.volunteerId);

            return (
              <div
                key={row.volunteerId}
                ref={(el) => {
                  if (el) {
                    tileRefs.current.set(row.volunteerId, el);
                  } else {
                    tileRefs.current.delete(row.volunteerId);
                  }
                }}
                className={`group relative rounded-lg border p-3.5 sm:p-4 will-change-transform ${
                  isTop1
                    ? "bg-gradient-to-r from-tedx-red/10 via-zinc-100/80 to-zinc-50 dark:from-tedx-red/15 dark:via-[#141418] dark:to-[#111114] border-tedx-red/40 dark:border-tedx-red/50 shadow-xs"
                    : isTop2
                    ? "bg-zinc-50/90 dark:bg-[#111114] border-zinc-300 dark:border-zinc-700/80 hover:border-zinc-400 dark:hover:border-zinc-600"
                    : isTop3
                    ? "bg-zinc-50/90 dark:bg-[#111114] border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700"
                    : "bg-white dark:bg-[#111114] border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs"
                } ${isRecentlyShifted ? "ring-1 ring-tedx-red/50 shadow-md" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Rank Badge + Volunteer Details */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {/* Rank Badge */}
                    <div className="flex flex-col items-center justify-center shrink-0 w-9 sm:w-10">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-mono font-black text-sm transition-transform duration-300 ${
                          isRecentlyShifted ? "scale-110" : "group-hover:scale-105"
                        } ${
                          isTop1
                            ? "bg-tedx-red text-white shadow-tedx"
                            : isTop2
                            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700"
                            : isTop3
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50"
                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        {row.rank}
                      </div>

                      {/* Rank delta indicator */}
                      <div className="mt-1">
                        {getRankMovement(row.volunteerId, row.rank)}
                      </div>
                    </div>

                    {/* Volunteer Name & Team */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {row.fullName}
                        </span>
                        {isTop1 && (
                          <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-tedx-red/15 text-tedx-red dark:text-tedx-lightred border border-tedx-red/20 shrink-0">
                            <Trophy className="w-2.5 h-2.5" /> Leader
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {getSafeVolunteerTeam(row.volunteerTeam)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics (Tickets & Points) */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-right">
                    {/* Tickets */}
                    <div className="hidden xs:block text-right">
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
                        Verified
                      </div>
                      <div className="text-xs sm:text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                        {row.verifiedTickets} <span className="text-[10px] font-normal text-zinc-400">tix</span>
                      </div>
                    </div>

                    {/* Points Total */}
                    <div className="text-right pl-2 sm:pl-3 border-l border-zinc-200 dark:border-zinc-800/80">
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
                        Points
                      </div>
                      <div className="text-sm sm:text-base font-mono font-black text-zinc-900 dark:text-white flex items-baseline justify-end gap-1">
                        <span className={isTop1 ? "text-tedx-red dark:text-tedx-lightred" : ""}>
                          {row.points}
                        </span>
                        <span className="text-[10px] font-normal text-zinc-400">pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footnote Notice */}
      <div className="px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e0e11] text-[11px] text-zinc-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
        <span className="flex items-center gap-1.5">
          {isDemoData ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-tedx-red shrink-0" />
              <span>
                <strong>Leaderboard Preview:</strong> Sample demonstration rankings for illustration only.
              </span>
            </>
          ) : (
            <>
              <Trophy className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                <strong>Official Challenge Standings:</strong> Live rankings aggregated directly from verified Meeteor Hub ticket claims.
              </span>
            </>
          )}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
          Rule: {scoringMultiplier} pts / verified ticket
        </span>
      </div>
    </div>
  );
}
