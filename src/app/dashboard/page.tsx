"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanningData, Allocation, Employee } from "@/lib/types";
import { getWorkingDaysInMonth, formatMonthYear } from "@/lib/dates";
import { daysToPercentage } from "@/lib/availability";

export default function DashboardPage() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
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

  const workingDays = getWorkingDaysInMonth(year, month);
  const totalCapacity = data.employees.length * workingDays;
  const totalTimeOff = data.timeOff.length;
  const totalUnbillable = Math.round(data.unbillable.reduce((s, u) => s + u.plannedDays, 0));
  const totalBillable = Math.round(data.allocations.reduce((s, a) => s + a.plannedDays, 0));
  const billableCapacity = totalCapacity - totalTimeOff - totalUnbillable;
  const utilization = billableCapacity > 0 ? Math.round((totalBillable / billableCapacity) * 100) : 0;

  // Per-employee data
  const employeeData = data.employees.map((emp) => {
    const empTimeOff = data.timeOff.filter((t) => t.employeeId === emp.id);
    const nonWorkingDays = empTimeOff.length;
    const empUnbillable = data.unbillable.filter((u) => u.employeeId === emp.id);
    const empUnbillableDays = Math.round(empUnbillable.reduce((s, u) => s + u.plannedDays, 0));
    const empAllocations = data.allocations.filter((a) => a.employeeId === emp.id);
    const totalPlanned = Math.round(empAllocations.reduce((s, a) => s + a.plannedDays, 0));
    const capacity = workingDays;
    const available = capacity - nonWorkingDays - empUnbillableDays;
    const util = available > 0 ? Math.round((totalPlanned / available) * 100) : 0;

    // Group allocations by client, then by project
    const clientMap = new Map<string, {
      clientName: string;
      clientId: string;
      totalDays: number;
      projects: { projectName: string; projectId: string; days: number }[];
    }>();
    for (const a of empAllocations) {
      const clientName = a.project?.client?.name || "Unknown";
      const clientId = a.project?.client?.id || a.project?.clientId || "unknown";
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, { clientName, clientId, totalDays: 0, projects: [] });
      }
      const clientEntry = clientMap.get(clientId)!;
      const existingProj = clientEntry.projects.find((p) => p.projectId === a.projectId);
      if (existingProj) {
        existingProj.days += a.plannedDays;
      } else {
        clientEntry.projects.push({
          projectName: a.project?.name || "Unknown",
          projectId: a.projectId,
          days: a.plannedDays,
        });
      }
      clientEntry.totalDays += a.plannedDays;
    }

    // Time off breakdown by type
    const timeOffByType: Record<string, number> = {};
    for (const t of empTimeOff) {
      timeOffByType[t.type] = (timeOffByType[t.type] || 0) + 1;
    }

    // Unbillable breakdown by category
    const unbillableByCategory: Record<string, number> = {};
    for (const u of empUnbillable) {
      unbillableByCategory[u.category] = (unbillableByCategory[u.category] || 0) + u.plannedDays;
    }

    const remaining = Math.round(available - totalPlanned);

    // Round all day values in client groups
    for (const entry of clientMap.values()) {
      entry.totalDays = Math.round(entry.totalDays);
      for (const p of entry.projects) {
        p.days = Math.round(p.days);
      }
    }

    return {
      employee: emp,
      capacity,
      totalPlanned: Math.round(totalPlanned),
      nonWorkingDays,
      unbillable: Math.round(empUnbillableDays),
      available,
      utilization: util,
      clientGroups: Array.from(clientMap.values()).sort((a, b) => b.totalDays - a.totalDays),
      timeOffByType,
      unbillableByCategory,
      remaining,
    };
  });

  // Per-client data
  const clientData = (data.clients || []).map((client) => {
    const clientProjectIds = new Set(client.projects?.map((p) => p.id) || []);
    const clientAllocs = data.allocations.filter((a) => clientProjectIds.has(a.projectId));
    const totalPlanned = Math.round(clientAllocs.reduce((s, a) => s + a.plannedDays, 0));

    // Group by project
    const projectMap = new Map<string, { projectName: string; projectId: string; days: number; employees: Set<string> }>();
    for (const a of clientAllocs) {
      if (!projectMap.has(a.projectId)) {
        projectMap.set(a.projectId, {
          projectName: a.project?.name || "Unknown",
          projectId: a.projectId,
          days: 0,
          employees: new Set(),
        });
      }
      const entry = projectMap.get(a.projectId)!;
      entry.days += a.plannedDays;
      entry.employees.add(a.employeeId);
    }

    const projects = Array.from(projectMap.values())
      .sort((a, b) => b.days - a.days)
      .map((p) => ({ ...p, days: Math.round(p.days), employeeCount: p.employees.size }));

    return {
      client,
      totalPlanned,
      projectCount: client.projects?.length || 0,
      projects,
    };
  }).filter((c) => c.projectCount > 0 || c.totalPlanned > 0);

  function toggleExpanded(empId: string) {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  function toggleExpandedClient(clientId: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  // Save allocation (same pattern as planning grid)
  async function saveAllocation(employeeId: string, projectId: string, days: number) {
    const mondays: Date[] = [];
    const d = new Date(Date.UTC(year, month, 1));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCMonth() === month) {
      mondays.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 7);
    }

    // Delete existing
    const existing = data!.allocations.filter(
      (a) => a.employeeId === employeeId && a.projectId === projectId
    );
    for (const a of existing) {
      await fetch(`/api/allocations/${a.id}`, { method: "DELETE" });
    }

    // Create new distributed allocations
    if (days > 0 && mondays.length > 0) {
      const daysPerWeek = days / mondays.length;
      for (const monday of mondays) {
        await fetch("/api/allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            projectId,
            weekStartDate: monday.toISOString(),
            plannedDays: Math.round(daysPerWeek * 2) / 2,
          }),
        });
      }
    }

    fetchData();
  }

  const timeOffLabel = (type: string) => {
    switch (type) {
      case "vacation": return "vacation";
      case "sick": return "sick";
      case "public_holiday": return "holiday";
      default: return type;
    }
  };

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

      {/* Employee Utilization Table */}
      <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
        <div className="bg-[#006284] text-white py-3 px-5">
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-poppins)" }}>
            Employee Utilization &mdash; {formatMonthYear(year, month)}
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
              <TableHead className="font-semibold text-[#000] w-[250px]">Employee</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Capacity</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Planned</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Non-Working</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeeData.map((ed, idx) => {
              const isExpanded = expandedEmployees.has(ed.employee.id);
              return (
                <React.Fragment key={ed.employee.id}>
                  {/* Employee summary row */}
                  <TableRow
                    className={`border-b-[#e2e4e7] cursor-pointer transition-colors ${
                      isExpanded ? "bg-[#e8f7fa]" : idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"
                    } hover:bg-[#e8f7fa]/60`}
                    onClick={() => toggleExpanded(ed.employee.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 text-[#006284] transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-[#000]">{ed.employee.name}</div>
                            <div className="text-xs text-[#747577]">{ed.employee.role}</div>
                          </div>
                          <Link
                            href={`/dashboard/employee/${ed.employee.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#747577] hover:text-[#006284] transition-colors ml-1"
                            title="View employee page"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-[#747577]">{ed.capacity}d</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${ed.totalPlanned > ed.available ? "text-red-600" : "text-[#006284]"}`}>
                        {ed.totalPlanned}d
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {ed.nonWorkingDays > 0 ? (
                        <Badge className="bg-[#faa61a]/10 text-[#faa61a] border-0">{ed.nonWorkingDays}d</Badge>
                      ) : (
                        <span className="text-[#e2e4e7]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className={`border-0 ${
                          ed.utilization > 100 ? "bg-red-50 text-red-600" :
                          ed.utilization >= 80 ? "bg-[#006284]/10 text-[#006284]" :
                          "bg-[#faa61a]/10 text-[#faa61a]"
                        }`}>
                          {ed.utilization}%
                        </Badge>
                        {/* Utilization bar */}
                        <div className="w-16 h-1 bg-[#e2e4e7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(ed.utilization, 100)}%`,
                              backgroundColor: ed.utilization > 100 ? "#dc2626" : "#006284",
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded: client-grouped project rows */}
                  {isExpanded && ed.clientGroups.length > 0 && ed.clientGroups.map((cg) => (
                    <React.Fragment key={`${ed.employee.id}-client-${cg.clientId}`}>
                      {/* Client subtotal row */}
                      <TableRow className="bg-[#f5f6f7] border-b-[#e2e4e7]">
                        <TableCell className="pl-10" colSpan={2}>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#004d68]">
                            <span>{cg.clientName}</span>
                            <span className="text-[#747577] font-normal">
                              &mdash; {daysToPercentage(Math.round(cg.totalDays), ed.available)}% ({Math.round(cg.totalDays)}d)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                      {/* Project rows under this client */}
                      {cg.projects.sort((a, b) => b.days - a.days).map((proj) => (
                        <ProjectAllocationRow
                          key={`${ed.employee.id}-${proj.projectId}`}
                          employeeId={ed.employee.id}
                          projectId={proj.projectId}
                          projectName={proj.projectName}
                          clientName={cg.clientName}
                          days={Math.round(proj.days)}
                          onSave={saveAllocation}
                          showClientName={false}
                        />
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Non-working / Unbillable / Remaining summary */}
                  {isExpanded && (
                    <TableRow className="bg-[#fafbfc] border-b-[#e2e4e7]">
                      <TableCell colSpan={5} className="pl-10 py-2">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#747577]">
                          {Object.keys(ed.timeOffByType).length > 0 && (
                            <span>
                              <span className="font-medium text-[#faa61a]">Non-working:</span>{" "}
                              {Object.entries(ed.timeOffByType)
                                .map(([type, count]) => `${Math.round(count)}d ${timeOffLabel(type)}`)
                                .join(", ")}
                            </span>
                          )}
                          {Object.keys(ed.unbillableByCategory).length > 0 && (
                            <span>
                              <span className="font-medium text-[#87d3df]">Unbillable:</span>{" "}
                              {Object.entries(ed.unbillableByCategory)
                                .map(([cat, days]) => `${Math.round(days)}d ${cat}`)
                                .join(", ")}
                            </span>
                          )}
                          <span>
                            <span className={`font-medium ${ed.remaining < 0 ? "text-red-600" : "text-[#006284]"}`}>
                              Remaining:
                            </span>{" "}
                            {ed.remaining}d
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {isExpanded && ed.clientGroups.length === 0 && (
                    <TableRow key={`${ed.employee.id}-empty`} className="bg-[#fafbfc]">
                      <TableCell colSpan={5} className="text-center py-3 text-[#747577] text-xs">
                        No project allocations this month
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Client Overview Table */}
      <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
        <div className="bg-[#004d68] text-white py-3 px-5">
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-poppins)" }}>
            Client Overview &mdash; {formatMonthYear(year, month)}
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
              <TableHead className="font-semibold text-[#000] w-[250px]">Client</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Projects</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Planned Days</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Budget (Fabric)</TableHead>
              <TableHead className="text-center font-semibold text-[#000]">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientData.map((cd, idx) => {
              const isExpanded = expandedClients.has(cd.client.id);
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
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-[#747577]">{cd.projectCount}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-[#006284]">{cd.totalPlanned}d</span>
                    </TableCell>
                    <TableCell className="text-center"><span className="text-[#87d3df] text-xs italic">Fabric</span></TableCell>
                    <TableCell className="text-center"><span className="text-[#87d3df] text-xs italic">Fabric</span></TableCell>
                  </TableRow>

                  {isExpanded && cd.projects.map((proj) => (
                    <TableRow key={`${cd.client.id}-${proj.projectId}`} className="bg-[#f5f6f7]/50 border-b-[#e2e4e7]">
                      <TableCell className="pl-12">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-[#87d3df]">&bull;</span>
                          <span className="text-[#000]">{proj.projectName}</span>
                          <span className="text-[#747577] text-xs">{proj.employeeCount} people</span>
                        </div>
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-center">
                        <span className="font-medium text-[#006284]">{proj.days}d</span>
                      </TableCell>
                      <TableCell className="text-center"><span className="text-[#87d3df] text-xs italic">Fabric</span></TableCell>
                      <TableCell className="text-center"><span className="text-[#87d3df] text-xs italic">Fabric</span></TableCell>
                    </TableRow>
                  ))}
                  {isExpanded && cd.projects.length === 0 && (
                    <TableRow key={`${cd.client.id}-empty`} className="bg-[#fafbfc]">
                      <TableCell colSpan={5} className="text-center py-3 text-[#747577] text-xs">
                        No project allocations this month
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {clientData.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-[#747577]">
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

// Inline-editable project allocation row
function ProjectAllocationRow({
  employeeId,
  projectId,
  projectName,
  clientName,
  days,
  onSave,
  showClientName = true,
}: {
  employeeId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  days: number;
  onSave: (empId: string, projId: string, days: number) => Promise<void>;
  showClientName?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(days.toString());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(days.toString()); }, [days]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const newDays = parseFloat(editValue) || 0;
    if (newDays !== days) {
      setSaving(true);
      await onSave(employeeId, projectId, newDays);
      setSaving(false);
    }
    setEditing(false);
  };

  return (
    <TableRow className={`bg-[#f5f6f7]/50 border-b-[#e2e4e7] ${saving ? "opacity-50" : ""}`}>
      <TableCell className="pl-16">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#87d3df]">&bull;</span>
          <div>
            <span className="text-[#000]">{projectName}</span>
            {showClientName && <span className="text-[#747577] text-xs ml-2">{clientName}</span>}
          </div>
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="text-center">
        {editing ? (
          <Input
            ref={inputRef}
            type="number"
            min={0}
            step={0.5}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setEditing(false); setEditValue(days.toString()); }
            }}
            className="w-20 mx-auto text-center border-[#87d3df] ring-1 ring-[#87d3df]"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="font-medium text-[#006284] px-3 py-1 rounded hover:bg-[#e8f7fa] transition-colors"
          >
            {days}d
          </button>
        )}
      </TableCell>
      <TableCell />
      <TableCell />
    </TableRow>
  );
}
