"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanningData } from "@/lib/types";
import { getWorkingDaysInMonth, formatMonthYear } from "@/lib/dates";

export default function DashboardPage() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/planning?year=${year}&month=${month}`, { cache: "no-store" });
    setData(await res.json());
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center gap-3 text-[#747577]">
        <svg className="animate-spin h-5 w-5 text-[#006284]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading dashboard...
      </div>
    );
  }

  const totalCapacity = data.employees.reduce(
    (sum, emp) => sum + getWorkingDaysInMonth(year, month, emp.country),
    0
  );
  const totalTimeOff = data.timeOff.length;
  const totalUnbillable = Math.round(data.unbillable.reduce((s, u) => s + u.plannedDays, 0));
  const totalBillable = Math.round(data.allocations.reduce((s, a) => s + a.plannedDays, 0));
  const billableCapacity = totalCapacity - totalTimeOff - totalUnbillable;
  const utilization = billableCapacity > 0 ? Math.round((totalBillable / billableCapacity) * 100) : 0;

  // Per-client data with percentage breakdown
  const clientData = (data.clients || []).map((client) => {
    const clientProjectIds = new Set(client.projects?.map((p) => p.id) || []);
    const clientAllocs = data.allocations.filter((a) => clientProjectIds.has(a.projectId));
    const totalPlanned = Math.round(clientAllocs.reduce((s, a) => s + a.plannedDays, 0));

    // Group by project
    const projectMap = new Map<string, { projectName: string; projectId: string; days: number; employees: Set<string>; budgetId: string | null }>();
    for (const a of clientAllocs) {
      if (!projectMap.has(a.projectId)) {
        const proj = data.projects.find((p) => p.id === a.projectId);
        projectMap.set(a.projectId, {
          projectName: a.project?.name || "Unknown",
          projectId: a.projectId,
          days: 0,
          employees: new Set(),
          budgetId: proj?.budgetId || null,
        });
      }
      const entry = projectMap.get(a.projectId)!;
      entry.days += a.plannedDays;
      entry.employees.add(a.employeeId);
    }

    // Budget from allAllocations (all-time)
    const allTimeAllocs = (data.allAllocations || []).filter((a) => clientProjectIds.has(a.projectId));

    const projects = Array.from(projectMap.values())
      .sort((a, b) => b.days - a.days)
      .map((p) => {
        const proj = data.projects.find((pr) => pr.id === p.projectId);
        const allTimeDays = Math.round(allTimeAllocs.filter((a) => a.projectId === p.projectId).reduce((s, a) => s + a.plannedDays, 0));
        const budgetDays = proj?.budgetDays ?? null;
        const remaining = budgetDays != null ? Math.round(budgetDays - allTimeDays) : null;
        return { ...p, days: Math.round(p.days), employeeCount: p.employees.size, budgetDays, usedDays: allTimeDays, remaining };
      });

    // Group projects by budget for expanded view
    const clientBudgets = (data.budgets || []).filter((b) => b.clientId === client.id);
    const budgetGroups = clientBudgets.map((budget) => {
      const budgetProjectIds = new Set((budget.projects || []).map((p) => p.id));
      const budgetProjects = projects.filter((p) => budgetProjectIds.has(p.projectId));
      const budgetAllTimeUsed = Math.round(
        allTimeAllocs.filter((a) => budgetProjectIds.has(a.projectId)).reduce((s, a) => s + a.plannedDays, 0)
      );
      const budgetRemaining = budget.budgetDays != null ? Math.round(budget.budgetDays - budgetAllTimeUsed) : null;
      return { budget, projects: budgetProjects, budgetAllTimeUsed, budgetRemaining };
    });

    const unassignedProjects = projects.filter((p) => !p.budgetId);

    return {
      client,
      totalPlanned,
      projectCount: client.projects?.length || 0,
      projects,
      budgetGroups,
      unassignedProjects,
    };
  }).filter((c) => c.projectCount > 0 || c.totalPlanned > 0);

  const grandTotalPlanned = clientData.reduce((s, c) => s + c.totalPlanned, 0);

  function toggleExpandedClient(clientId: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth} className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </Button>
          <span className="font-semibold min-w-[160px] text-center text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
            {formatMonthYear(year, month)}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth} className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#006284]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{totalCapacity}d</div>
            <div className="text-xs text-[#747577]">Total Capacity</div>
          </CardContent>
        </Card>
        <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#faa61a]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-[#faa61a]" style={{ fontFamily: "var(--font-poppins)" }}>{totalTimeOff}d</div>
            <div className="text-xs text-[#747577]">Time Off</div>
          </CardContent>
        </Card>
        <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#87d3df]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-[#87d3df]" style={{ fontFamily: "var(--font-poppins)" }}>{totalUnbillable}d</div>
            <div className="text-xs text-[#747577]">Unbillable</div>
          </CardContent>
        </Card>
        <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#006284]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>{totalBillable}d</div>
            <div className="text-xs text-[#747577]">Billable Planned</div>
          </CardContent>
        </Card>
        <Card className={`border-[#e2e4e7] shadow-sm border-l-4 ${utilization > 100 ? "border-l-red-500" : utilization >= 80 ? "border-l-[#006284]" : "border-l-[#faa61a]"}`}>
          <CardContent className="pt-5 pb-4">
            <div className={`text-2xl font-bold ${utilization > 100 ? "text-red-600" : utilization >= 80 ? "text-[#006284]" : "text-[#faa61a]"}`} style={{ fontFamily: "var(--font-poppins)" }}>
              {utilization}%
            </div>
            <div className="text-xs text-[#747577]">Utilization</div>
          </CardContent>
        </Card>
      </div>

      {/* Client Overview Table */}
      <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
        <div className="bg-[#006284] text-white py-3 px-5">
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-poppins)" }}>
            Client Overview &mdash; {formatMonthYear(year, month)}
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
              <TableHead className="font-semibold text-[#000] w-[250px]">Client</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Planned Days</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientData.map((cd, idx) => {
              const isExpanded = expandedClients.has(cd.client.id);
              const pctOfTotal = grandTotalPlanned > 0 ? Math.round((cd.totalPlanned / grandTotalPlanned) * 100) : 0;
              return (
                <React.Fragment key={cd.client.id}>
                  <TableRow
                    className={`border-b-[#e2e4e7] cursor-pointer transition-colors ${
                      isExpanded ? "bg-[#e8f7fa]" : idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"
                    } hover:bg-[#e8f7fa]/60`}
                    onClick={() => toggleExpandedClient(cd.client.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 text-[#006284] transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-semibold text-[#000]">{cd.client.name}</span>
                        <span className="text-xs text-[#747577]">({cd.projectCount} projects)</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-[#006284]">{cd.totalPlanned}d</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium text-[#000]">{pctOfTotal}%</span>
                        <div className="w-16 h-1.5 bg-[#e2e4e7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#006284] transition-all"
                            style={{ width: `${pctOfTotal}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded: group by budget */}
                  {isExpanded && cd.budgetGroups.map((bg) => (
                    <React.Fragment key={`budget-${bg.budget.id}`}>
                      {/* Budget header row */}
                      <TableRow className="bg-[#f5f6f7] border-b-[#e2e4e7]">
                        <TableCell className="pl-10">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-[#006284]">{bg.budget.name}</span>
                            {bg.budget.budgetDays != null && (
                              <span className={`text-xs ${
                                bg.budgetRemaining != null && bg.budgetRemaining < 0 ? "text-red-600 font-semibold" :
                                bg.budgetRemaining != null && bg.budget.budgetDays && bg.budgetRemaining < bg.budget.budgetDays * 0.2 ? "text-[#faa61a]" :
                                "text-[#747577]"
                              }`}>
                                {bg.budgetRemaining}d / {bg.budget.budgetDays}d budget
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-medium text-[#006284]">
                            {bg.projects.reduce((s, p) => s + p.days, 0)}d
                          </span>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      {/* Projects under budget */}
                      {bg.projects.map((proj) => (
                        <TableRow key={`${bg.budget.id}-${proj.projectId}`} className="bg-[#f5f6f7]/50 border-b-[#e2e4e7]">
                          <TableCell className="pl-16">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-[#87d3df]">&bull;</span>
                              <span className="text-[#000]">{proj.projectName}</span>
                              <span className="text-[#747577] text-xs">{proj.employeeCount} people</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-[#006284]">{proj.days}d</span>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Unassigned projects */}
                  {isExpanded && cd.unassignedProjects.length > 0 && (
                    <>
                      {cd.budgetGroups.length > 0 && (
                        <TableRow className="bg-[#f5f6f7] border-b-[#e2e4e7]">
                          <TableCell className="pl-10">
                            <span className="text-xs font-semibold text-[#747577]">Unassigned Projects</span>
                          </TableCell>
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      )}
                      {cd.unassignedProjects.map((proj) => (
                        <TableRow key={`${cd.client.id}-unassigned-${proj.projectId}`} className="bg-[#f5f6f7]/50 border-b-[#e2e4e7]">
                          <TableCell className={cd.budgetGroups.length > 0 ? "pl-16" : "pl-12"}>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-[#87d3df]">&bull;</span>
                              <span className="text-[#000]">{proj.projectName}</span>
                              <span className="text-[#747577] text-xs">{proj.employeeCount} people</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-[#006284]">{proj.days}d</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {proj.budgetDays != null ? (
                              <span className={`text-xs ${
                                proj.remaining != null && proj.remaining < 0 ? "text-red-600 font-semibold" :
                                proj.remaining != null && proj.budgetDays && proj.remaining < proj.budgetDays * 0.2 ? "text-[#faa61a]" :
                                "text-[#747577]"
                              }`}>
                                {proj.remaining}d / {proj.budgetDays}d budget
                              </span>
                            ) : (
                              <span className="text-[#e2e4e7] text-xs">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {isExpanded && cd.projects.length === 0 && (
                    <TableRow key={`${cd.client.id}-empty`} className="bg-[#fafbfc]">
                      <TableCell colSpan={3} className="text-center py-3 text-[#747577] text-xs">
                        No project allocations this month
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {clientData.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-[#747577]">
                  No client allocations this month
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
