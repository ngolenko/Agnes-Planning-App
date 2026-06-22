"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PlanningData,
  Allocation,
  Employee,
  Client,
  Project,
} from "@/lib/types";
import { getWorkingDaysInMonth, getEmployeeWorkingDaysInMonth, formatMonthYear, getWeekStartDate } from "@/lib/dates";
import type { CountryCode } from "@/lib/types";
import {
  getEmployeeAvailableDays,
  getEmployeeTimeOffWorkDays,
  percentageToDays,
  daysToPercentage,
  formatDays,
} from "@/lib/availability";

export function PlanningGrid() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"client" | "resource" | "project">("client");
  const [planningMode, setPlanningMode] = useState<"monthly" | "weekly">("monthly");
  const [weekStart, setWeekStart] = useState<string>(() => {
    const monday = getWeekStartDate(new Date());
    return monday.toISOString().split("T")[0];
  });

  // Percentage overrides: stores user-entered percentages keyed by "empId::clientId"
  // This is the source of truth for display — percentages are never back-calculated from days
  const [percentOverrides, setPercentOverrides] = useState<Map<string, number>>(new Map());

  // Resource view state
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedEmpClients, setExpandedEmpClients] = useState<Set<string>>(new Set());
  const [addingProjectTo, setAddingProjectTo] = useState<string | null>(null);
  const [newProjectId, setNewProjectId] = useState("");
  const [newProjectDays, setNewProjectDays] = useState("");
  const [addingClientTo, setAddingClientTo] = useState<string | null>(null);
  const [newClientId, setNewClientId] = useState("");

  // Project view state
  const [expandedPVClients, setExpandedPVClients] = useState<Set<string>>(new Set());
  const [expandedPVBudgets, setExpandedPVBudgets] = useState<Set<string>>(new Set());
  const [expandedPVProjects, setExpandedPVProjects] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const url = planningMode === "weekly"
      ? `/api/planning?weekStart=${weekStart}`
      : `/api/planning?year=${year}&month=${month}`;
    const res = await fetch(url, { cache: "no-store" });
    setData(await res.json());
    setLoading(false);
  }, [year, month, planningMode, weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const prevWeek = () => {
    const d = new Date(weekStart + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() - 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };
  const nextWeek = () => {
    const d = new Date(weekStart + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };
  const formatWeekLabel = (iso: string) => {
    const d = new Date(iso + "T00:00:00.000Z");
    return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center gap-3 text-[#747577]">
        <svg className="animate-spin h-5 w-5 text-[#006284]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading planning data...
      </div>
    );
  }

  const workingDays = getWorkingDaysInMonth(year, month);
  const totalPlanned = data.allocations.reduce((s, a) => s + a.plannedDays, 0);

  // ── Shared helpers ──

  function getWorkingDaysForEmployee(emp: Employee): number {
    return getEmployeeWorkingDaysInMonth(emp.weeklyCapacityDays, year, month, emp.country as CountryCode);
  }

  function getEmployeeAvail(empId: string): number {
    const emp = data!.employees.find((e) => e.id === empId);
    const empWorkingDays = emp ? getWorkingDaysForEmployee(emp) : workingDays;
    const capacity = emp?.weeklyCapacityDays ?? 5;
    return getEmployeeAvailableDays(empId, empWorkingDays, data!.timeOff, data!.unbillable, capacity);
  }

  function getMondays(): Date[] {
    const mondays: Date[] = [];
    const d = new Date(Date.UTC(year, month, 1));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCMonth() === month) {
      mondays.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return mondays;
  }

  async function savePersonAllocation(employeeId: string, projectId: string, days: number, skipRefetch = false) {
    const mondays = getMondays();
    const existing = data!.allocations.filter(
      (a) => a.employeeId === employeeId && a.projectId === projectId
    );
    for (const a of existing) {
      await fetch(`/api/allocations/${a.id}`, { method: "DELETE" });
    }
    if (days > 0 && mondays.length > 0) {
      // Distribute fractional days across weeks; last week takes the exact remainder
      // so the sum across weeks equals `days` precisely (no rounding drift).
      const perWeek = days / mondays.length;
      let allocated = 0;
      for (let i = 0; i < mondays.length; i++) {
        const thisWeek = i === mondays.length - 1 ? days - allocated : perWeek;
        allocated += thisWeek;
        await fetch("/api/allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            projectId,
            weekStartDate: mondays[i].toISOString().split("T")[0],
            plannedDays: thisWeek,
          }),
        });
      }
    }
    if (!skipRefetch) fetchData();
  }

  function toggleEmployee(id: string) {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleEmpClient(key: string) {
    setExpandedEmpClients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Client View: Matrix data ──

  const clientsWithProjects = (data.clients || []).filter(
    (c) => c.projects && c.projects.length > 0
  );

  const matrix = data.employees
    .filter((emp) => emp.isActive)
    .map((emp) => {
      const availDays = getEmployeeAvail(emp.id);
      const timeOffDays = getEmployeeTimeOffWorkDays(emp.id, data!.timeOff, emp.weeklyCapacityDays);
      const unbillableDays = data!.unbillable.filter((u) => u.employeeId === emp.id).reduce((s, u) => s + u.plannedDays, 0);
      const clientAllocs = clientsWithProjects.map((client) => {
        const clientProjectIds = new Set(client.projects?.map((p) => p.id) || []);
        const days = data!.allocations
          .filter((a) => a.employeeId === emp.id && clientProjectIds.has(a.projectId))
          .reduce((s, a) => s + a.plannedDays, 0);
        // Use user-entered percentage if available, otherwise derive from days
        const overrideKey = `${emp.id}::${client.id}`;
        const percent = percentOverrides.has(overrideKey)
          ? percentOverrides.get(overrideKey)!
          : daysToPercentage(days, availDays);
        return { client, days, percent };
      });
      // Compute totals from sum of per-client days (already rounded) to stay consistent
      const totalDays = clientAllocs.reduce((s, c) => s + c.days, 0);
      const totalPercent = daysToPercentage(totalDays, availDays);
      return { employee: emp, availDays, timeOffDays, unbillableDays, clientAllocs, totalPercent, totalDays };
    });

  // Handle saving from the matrix: when a % cell is edited for (employee, client)
  async function handleMatrixCellSave(employeeId: string, client: Client & { projects: Project[] }, newPercent: number) {
    // Store the user's entered percentage — this is the source of truth for display
    const overrideKey = `${employeeId}::${client.id}`;
    setPercentOverrides((prev) => {
      const next = new Map(prev);
      if (newPercent === 0) {
        next.delete(overrideKey);
      } else {
        next.set(overrideKey, newPercent);
      }
      return next;
    });

    const availDays = getEmployeeAvail(employeeId);
    const newTotalDays = percentageToDays(newPercent, availDays);
    const projects = client.projects || [];

    if (projects.length === 0) return;

    if (projects.length === 1) {
      // Single project — all days go to it
      await savePersonAllocation(employeeId, projects[0].id, newTotalDays);
      return;
    }

    // Multiple projects — check existing split and scale proportionally
    const existingByProject = projects.map((proj) => {
      const days = data!.allocations
        .filter((a) => a.employeeId === employeeId && a.projectId === proj.id)
        .reduce((s, a) => s + a.plannedDays, 0);
      return { project: proj, days };
    });

    const oldTotal = existingByProject.reduce((s, p) => s + p.days, 0);

    if (oldTotal === 0) {
      // No existing split — put all days on the first project; refine per-project in Resource view
      await savePersonAllocation(employeeId, projects[0].id, newTotalDays, true);
    } else {
      // Scale proportionally (last project takes exact remainder)
      let allocated = 0;
      for (let i = 0; i < existingByProject.length; i++) {
        const entry = existingByProject[i];
        const newDays = i === existingByProject.length - 1
          ? newTotalDays - allocated
          : (entry.days / oldTotal) * newTotalDays;
        await savePersonAllocation(employeeId, entry.project.id, Math.max(0, newDays), true);
        allocated += newDays;
      }
    }
    // Refetch once after all project saves are done
    fetchData();
  }

  // ── Resource View tree ──

  const resourceTree = data.employees
    .filter((emp) => emp.isActive)
    .map((emp) => {
      const empAllocs = data.allocations.filter((a) => a.employeeId === emp.id);
      const availDays = getEmployeeAvail(emp.id);

      const clientMap = new Map<string, { client: Client; projects: { project: Project; days: number }[]; totalDays: number }>();

      for (const alloc of empAllocs) {
        const proj = alloc.project;
        if (!proj || !proj.client) continue;
        const clientId = proj.client.id;
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, { client: proj.client, projects: [], totalDays: 0 });
        }
        const entry = clientMap.get(clientId)!;
        const existingProj = entry.projects.find((p) => p.project.id === proj.id);
        if (existingProj) {
          existingProj.days += alloc.plannedDays;
        } else {
          entry.projects.push({ project: proj, days: alloc.plannedDays });
        }
        entry.totalDays += alloc.plannedDays;
      }

      for (const entry of clientMap.values()) {
        entry.totalDays = entry.projects.reduce((s, p) => s + p.days, 0);
      }

      // Derive allocatedDays from rounded client totals so it matches the breakdown
      const allocatedDays = Array.from(clientMap.values()).reduce((s, e) => s + e.totalDays, 0);
      const remainingDays = availDays - allocatedDays;
      const allocPercent = daysToPercentage(allocatedDays, availDays);

      return {
        employee: emp,
        availDays,
        allocatedDays,
        remainingDays,
        allocPercent,
        clients: Array.from(clientMap.values()).sort((a, b) => b.totalDays - a.totalDays),
      };
    })
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  // ── Resource View handlers ──

  async function handleAddProject(employeeId: string, _clientId: string) {
    if (!newProjectId) return;
    const days = Math.round(parseFloat(newProjectDays) || 5);
    await savePersonAllocation(employeeId, newProjectId, days);
    setAddingProjectTo(null);
    setNewProjectId("");
    setNewProjectDays("");
  }

  async function handleAddEmployeeAllocation(employeeId: string) {
    if (!newProjectId) return;
    const days = Math.round(parseFloat(newProjectDays) || 5);
    await savePersonAllocation(employeeId, newProjectId, days);
    setAddingClientTo(null);
    setNewClientId("");
    setNewProjectId("");
    setNewProjectDays("");
  }

  // ── Render ──

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>Resource Planning</h2>
          <p className="text-sm text-[#747577] mt-1">
            {planningMode === "weekly" ? (
              <>{formatWeekLabel(weekStart)} &middot; {Math.round(totalPlanned)}d planned</>
            ) : (
              <>
                {(() => {
                  const countries = new Set(data.employees.filter((e) => e.isActive).map((e) => e.country));
                  if (countries.size <= 1) {
                    const country = (data.employees.find((e) => e.isActive)?.country as CountryCode) || "DE";
                    return `${getWorkingDaysInMonth(year, month, country)} working days`;
                  }
                  const deCounts = getWorkingDaysInMonth(year, month, "DE");
                  const roCounts = getWorkingDaysInMonth(year, month, "RO");
                  return `${Math.min(deCounts, roCounts)}-${Math.max(deCounts, roCounts)} working days`;
                })()} &middot; {Math.round(totalPlanned)}d planned &middot; {formatMonthYear(year, month)}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Planning Mode Toggle */}
          <div className="flex rounded-md border border-[#e2e4e7] overflow-hidden">
            <button
              onClick={() => setPlanningMode("monthly")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                planningMode === "monthly"
                  ? "bg-[#006284] text-white"
                  : "bg-white text-[#747577] hover:bg-[#e8f7fa] hover:text-[#006284]"
              }`}
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Monthly
            </button>
            <button
              onClick={() => setPlanningMode("weekly")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-[#e2e4e7] ${
                planningMode === "weekly"
                  ? "bg-[#006284] text-white"
                  : "bg-white text-[#747577] hover:bg-[#e8f7fa] hover:text-[#006284]"
              }`}
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Weekly
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex rounded-md border border-[#e2e4e7] overflow-hidden">
            <button
              onClick={() => setViewMode("client")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "client"
                  ? "bg-[#006284] text-white"
                  : "bg-white text-[#747577] hover:bg-[#e8f7fa] hover:text-[#006284]"
              }`}
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Client View
            </button>
            <button
              onClick={() => setViewMode("resource")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-[#e2e4e7] ${
                viewMode === "resource"
                  ? "bg-[#006284] text-white"
                  : "bg-white text-[#747577] hover:bg-[#e8f7fa] hover:text-[#006284]"
              }`}
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Resource View
            </button>
            <button
              onClick={() => setViewMode("project")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-[#e2e4e7] ${
                viewMode === "project"
                  ? "bg-[#006284] text-white"
                  : "bg-white text-[#747577] hover:bg-[#e8f7fa] hover:text-[#006284]"
              }`}
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Project View
            </button>
          </div>

          {/* Period navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={planningMode === "weekly" ? prevWeek : prevMonth} className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </Button>
            <span className="font-semibold min-w-[180px] text-center text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
              {planningMode === "weekly" ? formatWeekLabel(weekStart) : formatMonthYear(year, month)}
            </span>
            <Button variant="outline" size="sm" onClick={planningMode === "weekly" ? nextWeek : nextMonth} className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          CLIENT VIEW — Matrix Table
         ════════════════════════════════════════════════════════════ */}
      {viewMode === "client" && (
        <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
          <CardHeader className="bg-[#006284] text-white py-3 px-5">
            <CardTitle className="text-base text-white" style={{ fontFamily: "var(--font-poppins)" }}>
              Client Allocation &mdash; {formatMonthYear(year, month)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                  <TableHead className="font-semibold text-[#000] w-[200px] sticky left-0 bg-[#f5f6f7] z-10">Employee</TableHead>
                  <TableHead className="text-center font-semibold text-[#000] w-[80px]">Available</TableHead>
                  {clientsWithProjects.map((client) => (
                    <TableHead key={client.id} className="text-center font-semibold text-[#000] min-w-[120px]">
                      <div>
                        {client.name}
                        <div className="text-[10px] font-normal text-[#747577]">
                          {client.projects?.length === 1
                            ? client.projects[0].name
                            : `${client.projects?.length} projects`
                          }
                        </div>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold text-[#000] w-[80px] sticky right-0 bg-[#f5f6f7] z-10">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row, idx) => (
                  <TableRow
                    key={row.employee.id}
                    className={`border-b-[#e2e4e7] ${idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}`}
                  >
                    {/* Employee name */}
                    <TableCell className="sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? "white" : "#fafbfc" }}>
                      <div>
                        <span className="font-semibold text-[#000]">{row.employee.name}</span>
                        <span className="text-[#747577] text-xs ml-1.5">({row.employee.role})</span>
                      </div>
                    </TableCell>

                    {/* Available days */}
                    <TableCell className="text-center text-[#747577] font-medium">
                      <span
                        className="cursor-help border-b border-dotted border-[#747577]"
                        title={`${getWorkingDaysForEmployee(row.employee)}d working days${row.timeOffDays > 0 ? `\n- ${formatDays(row.timeOffDays)}d time off` : ""}${row.unbillableDays > 0 ? `\n- ${formatDays(row.unbillableDays)}d unbillable` : ""}\n= ${formatDays(row.availDays)}d available`}
                      >
                        {formatDays(row.availDays)}d
                      </span>
                    </TableCell>

                    {/* Client columns — editable % */}
                    {row.clientAllocs.map((ca) => (
                      <TableCell key={ca.client.id} className="text-center">
                        {ca.percent > 0 ? (
                          <div className="flex flex-col items-center">
                            <InlineEdit
                              value={ca.percent}
                              onSave={async (newPct) => {
                                await handleMatrixCellSave(row.employee.id, ca.client as Client & { projects: Project[] }, newPct);
                              }}
                              className="font-semibold text-[#006284]"
                              suffix="%"
                              step={1}
                            />
                            <span className="text-[10px] text-[#747577]">{formatDays(ca.days)}d</span>
                          </div>
                        ) : (
                          <InlineEdit
                            value={0}
                            onSave={async (newPct) => {
                              if (newPct > 0) {
                                await handleMatrixCellSave(row.employee.id, ca.client as Client & { projects: Project[] }, newPct);
                              }
                            }}
                            className="text-[#e2e4e7]"
                            suffix="%"
                            step={5}
                          />
                        )}
                      </TableCell>
                    ))}

                    {/* Total column */}
                    <TableCell
                      className="text-center font-bold sticky right-0 z-10"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "#fafbfc" }}
                    >
                      <span className={row.totalPercent > 100 ? "text-red-600" : row.totalPercent >= 80 ? "text-[#006284]" : "text-[#faa61a]"}>
                        {row.totalPercent}%
                      </span>
                      <div className="text-[10px] font-normal text-[#747577]">{formatDays(row.totalDays)}d</div>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                {(() => {
                  const totalAvailable = matrix.reduce((s, r) => s + r.availDays, 0);
                  const totalOverallPct = totalAvailable > 0 ? Math.round((totalPlanned / totalAvailable) * 100) : 0;
                  return (
                    <TableRow className="border-t-2 border-[#006284] bg-[#f5f6f7]">
                      <TableCell className="sticky left-0 bg-[#f5f6f7] z-10">
                        <span className="font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>Total</span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-[#747577]">
                        {formatDays(totalAvailable)}d
                      </TableCell>
                      {clientsWithProjects.map((client) => {
                        const clientProjectIds = new Set(client.projects?.map((p) => p.id) || []);
                        const totalClientDays = Math.round(
                          data.allocations
                            .filter((a) => clientProjectIds.has(a.projectId))
                            .reduce((s, a) => s + a.plannedDays, 0)
                        );
                        return (
                          <TableCell key={client.id} className="text-center">
                            <span className="font-bold text-[#006284]">{totalClientDays}d</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center sticky right-0 bg-[#f5f6f7] z-10">
                        <span className={`font-bold ${totalOverallPct > 100 ? "text-red-600" : totalOverallPct >= 80 ? "text-[#006284]" : "text-[#faa61a]"}`}>
                          {totalOverallPct}%
                        </span>
                        <div className="text-[10px] font-normal text-[#747577]">{Math.round(totalPlanned)}d</div>
                      </TableCell>
                    </TableRow>
                  );
                })()}

                {matrix.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={clientsWithProjects.length + 3} className="text-center py-8 text-[#747577]">
                      No active employees. Add them in Manage.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════
          RESOURCE VIEW — Project Breakdown
         ════════════════════════════════════════════════════════════ */}
      {viewMode === "resource" && (
        <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
          <CardHeader className="bg-[#006284] text-white py-3 px-5">
            <CardTitle className="text-base text-white" style={{ fontFamily: "var(--font-poppins)" }}>
              Resource Allocation &mdash; {formatMonthYear(year, month)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                  <TableHead className="font-semibold text-[#000] w-[350px]">Person / Client / Project</TableHead>
                  <TableHead className="text-center font-semibold text-[#000] w-[100px]">Utilization</TableHead>
                  <TableHead className="text-center font-semibold text-[#000] w-[120px]">Days</TableHead>
                  <TableHead className="text-center font-semibold text-[#000] w-[100px]">Available</TableHead>
                  <TableHead className="text-center font-semibold text-[#000] w-[100px]">Remaining</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resourceTree.map((empNode) => {
                  const empExpanded = expandedEmployees.has(empNode.employee.id);

                  return (
                    <React.Fragment key={empNode.employee.id}>
                      {/* EMPLOYEE ROW */}
                      <TableRow
                        className={`border-b-[#e2e4e7] cursor-pointer transition-colors ${
                          empExpanded ? "bg-[#006284]/5" : "bg-white"
                        } hover:bg-[#e8f7fa]/60`}
                        onClick={() => toggleEmployee(empNode.employee.id)}
                        style={{ borderLeft: "3px solid #006284" }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <svg className={`w-4 h-4 text-[#006284] transition-transform ${empExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{empNode.employee.name}</span>
                            <span className="text-[#747577] text-xs">({empNode.employee.role})</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-center"
                          title={`Utilization = ${formatDays(empNode.allocatedDays)}d planned / ${formatDays(empNode.availDays)}d available`}
                        >
                          <span className={`font-bold text-sm ${empNode.allocPercent > 100 ? "text-red-600" : empNode.allocPercent >= 80 ? "text-[#006284]" : "text-[#faa61a]"}`}>
                            {empNode.allocPercent}%
                          </span>
                          <div className="text-[10px] font-normal text-[#747577]">
                            {formatDays(empNode.allocatedDays)}/{formatDays(empNode.availDays)}d
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-[#006284]">
                          {formatDays(empNode.allocatedDays)}d
                        </TableCell>
                        <TableCell className="text-center text-[#747577]">
                          {formatDays(empNode.availDays)}d
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${empNode.remainingDays < 0 ? "text-red-600" : empNode.remainingDays === 0 ? "text-[#747577]" : "text-[#006284]"}`}>
                            {formatDays(empNode.remainingDays)}d
                          </span>
                        </TableCell>
                        <TableCell>
                          {empExpanded && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#006284] hover:bg-[#e8f7fa] text-xs h-7 px-2"
                              onClick={(e) => { e.stopPropagation(); setAddingClientTo(empNode.employee.id); }}
                            >
                              +
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* CLIENT ROWS within employee */}
                      {empExpanded && empNode.clients.map((clientNode) => {
                        const empClientKey = `${empNode.employee.id}::${clientNode.client.id}`;
                        const clientExpanded = expandedEmpClients.has(empClientKey);
                        const clientPercent = percentOverrides.has(empClientKey)
                          ? percentOverrides.get(empClientKey)!
                          : daysToPercentage(clientNode.totalDays, empNode.availDays);

                        const sumProjectDays = clientNode.projects.reduce((s, p) => s + p.days, 0);
                        const hasMismatch = Math.round(sumProjectDays) !== Math.round(clientNode.totalDays);

                        return (
                          <React.Fragment key={empClientKey}>
                            <TableRow
                              className={`border-b-[#e2e4e7] cursor-pointer transition-colors ${
                                clientExpanded ? "bg-[#004d68]/5" : "bg-[#fafbfc]"
                              } hover:bg-[#e8f7fa]/60`}
                              onClick={() => toggleEmpClient(empClientKey)}
                            >
                              <TableCell className="pl-10">
                                <div className="flex items-center gap-2">
                                  <svg className={`w-3.5 h-3.5 text-[#006284] transition-transform ${clientExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="font-semibold text-[#000]">{clientNode.client.name}</span>
                                  {hasMismatch && (
                                    <span className="text-[#faa61a]" title={`Project days (${Math.round(sumProjectDays)}d) don't match client total (${Math.round(clientNode.totalDays)}d)`}>
                                      &#9888;
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-semibold text-[#006284] text-sm">{clientPercent}%</span>
                              </TableCell>
                              <TableCell className="text-center font-semibold text-[#006284]">
                                {formatDays(clientNode.totalDays)}d
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell>
                                {clientExpanded && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#006284] hover:bg-[#e8f7fa] text-xs h-7 px-2"
                                    onClick={(e) => { e.stopPropagation(); setAddingProjectTo(empClientKey); }}
                                  >
                                    +
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>

                            {/* PROJECT ROWS within client within employee */}
                            {clientExpanded && clientNode.projects.map((projEntry) => (
                              <TableRow key={`${empClientKey}-${projEntry.project.id}`} className="border-b-[#e2e4e7] bg-[#f5f6f7]/50">
                                <TableCell className="pl-20">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[#87d3df]">&bull;</span>
                                    <span className="text-[#000]">{projEntry.project.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-center">
                                  <InlineEdit
                                    value={Math.round(projEntry.days)}
                                    onSave={(v) => savePersonAllocation(empNode.employee.id, projEntry.project.id, Math.round(v))}
                                    className="font-medium text-[#000]"
                                    step={1}
                                  />
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                                    onClick={() => savePersonAllocation(empNode.employee.id, projEntry.project.id, 0)}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* Add project row within client */}
                            {clientExpanded && addingProjectTo === empClientKey && (
                              <TableRow className="border-b-[#e2e4e7] bg-[#e8f7fa]/30">
                                <TableCell className="pl-20">
                                  <Select value={newProjectId} onValueChange={(v) => setNewProjectId(v ?? "")}>
                                    <SelectTrigger className="border-[#e2e4e7] w-[180px] h-8 text-sm">
                                      <SelectValue placeholder="Select project..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const fullClient = data.clients.find((c) => c.id === clientNode.client.id);
                                        const assignedProjectIds = new Set(clientNode.projects.map((p) => p.project.id));
                                        return (fullClient?.projects || [])
                                          .filter((p) => !assignedProjectIds.has(p.id))
                                          .map((proj) => (
                                            <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                                          ));
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={newProjectDays}
                                    onChange={(e) => setNewProjectDays(e.target.value)}
                                    className="w-16 mx-auto text-center border-[#e2e4e7] h-8 text-sm"
                                    placeholder="5"
                                  />
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell>
                                  <div className="flex gap-0.5">
                                    <Button size="sm" onClick={() => handleAddProject(empNode.employee.id, clientNode.client.id)} disabled={!newProjectId} className="bg-[#006284] hover:bg-[#004d68] text-white text-xs h-7 px-2">
                                      Add
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setAddingProjectTo(null); setNewProjectId(""); setNewProjectDays(""); }} className="text-[#747577] text-xs h-7 px-1">
                                      &times;
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Add allocation row — client + project + days */}
                      {empExpanded && addingClientTo === empNode.employee.id && (
                        <TableRow className="border-b-[#e2e4e7] bg-[#e8f7fa]/30">
                          <TableCell className="pl-10">
                            <div className="flex gap-2">
                              <Select
                                value={newClientId}
                                onValueChange={(v) => { setNewClientId(v ?? ""); setNewProjectId(""); }}
                              >
                                <SelectTrigger className="border-[#e2e4e7] w-[160px] h-8 text-sm">
                                  <SelectValue placeholder="Client..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {data.clients.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={newProjectId}
                                onValueChange={(v) => setNewProjectId(v ?? "")}
                                disabled={!newClientId}
                              >
                                <SelectTrigger className="border-[#e2e4e7] w-[180px] h-8 text-sm">
                                  <SelectValue placeholder="Project..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(data.clients.find((c) => c.id === newClientId)?.projects ?? []).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={newProjectDays}
                              onChange={(e) => setNewProjectDays(e.target.value)}
                              className="w-16 mx-auto text-center border-[#e2e4e7] h-8 text-sm"
                              placeholder="5"
                            />
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button size="sm" onClick={() => handleAddEmployeeAllocation(empNode.employee.id)} disabled={!newProjectId} className="bg-[#006284] hover:bg-[#004d68] text-white text-xs h-7 px-2">
                                Add
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setAddingClientTo(null); setNewClientId(""); setNewProjectId(""); setNewProjectDays(""); }} className="text-[#747577] text-xs h-7 px-1">
                                &times;
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {empExpanded && empNode.clients.length === 0 && addingClientTo !== empNode.employee.id && (
                        <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]/30">
                          <TableCell colSpan={6} className="text-center py-2 text-[#747577] text-xs pl-10">
                            No allocations. Click + to add a client allocation.
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {resourceTree.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-[#747577]">
                      No active employees. Add them in Manage.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════
          PROJECT VIEW — Budget & Allocation by Project
         ════════════════════════════════════════════════════════════ */}
      {viewMode === "project" && (() => {
        const togglePVClient = (id: string) => {
          setExpandedPVClients((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          });
        };
        const togglePVBudget = (id: string) => {
          setExpandedPVBudgets((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          });
        };
        const togglePVProject = (id: string) => {
          setExpandedPVProjects((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          });
        };

        // Helper: build project node with allocations
        function buildProjectNode(project: Project) {
          const currentAllocs = data!.allocations.filter((a) => a.projectId === project.id);
          const empMap = new Map<string, number>();
          for (const a of currentAllocs) {
            empMap.set(a.employeeId, (empMap.get(a.employeeId) || 0) + a.plannedDays);
          }
          const employees = Array.from(empMap.entries())
            .map(([empId, days]) => ({
              employee: data!.employees.find((e) => e.id === empId),
              days: Math.round(days),
            }))
            .filter((e) => e.employee && e.days > 0)
            .sort((a, b) => b.days - a.days);

          const daysThisMonth = Math.round(currentAllocs.reduce((s, a) => s + a.plannedDays, 0));
          const prevAllocs = data!.prevAllocations.filter((a) => a.projectId === project.id);
          const daysLastMonth = Math.round(prevAllocs.reduce((s, a) => s + a.plannedDays, 0));
          const allTimeAllocs = (data!.allAllocations || []).filter((a) => a.projectId === project.id);
          const usedDays = Math.round(allTimeAllocs.reduce((s, a) => s + a.plannedDays, 0));

          return { project, daysThisMonth, daysLastMonth, usedDays, employees };
        }

        // Build Client → Budget → Project hierarchy
        const projectViewData = clientsWithProjects.map((client) => {
          const clientProjects = client.projects || [];
          const clientBudgets = (data!.budgets || []).filter((b) => b.clientId === client.id);

          // Group projects by budget
          type ProjectNode = ReturnType<typeof buildProjectNode>;
          interface BudgetGroup {
            budgetId: string;
            budgetName: string;
            budgetDays: number | null;
            lastInvoiceDate: string | null;
            invoicedSoFar: number;
            remainingDays: number | null;
            sinceLastInvoice: number;
            projects: ProjectNode[];
            daysThisMonth: number;
          }

          const budgetGroups: BudgetGroup[] = clientBudgets.map((budget) => {
            const budgetProjectIds = new Set((budget.projects || []).map((p) => p.id));
            const budgetProjects = clientProjects
              .filter((p) => budgetProjectIds.has(p.id))
              .map(buildProjectNode);

            const lastDate = budget.lastInvoiceDate ? new Date(budget.lastInvoiceDate) : null;
            const allAllocs = data!.allAllocations || [];

            // Invoiced: only allocations up to lastInvoiceDate
            const invoicedSoFar = lastDate
              ? Math.round(
                  allAllocs
                    .filter((a) => budgetProjectIds.has(a.projectId) && new Date(a.weekStartDate) <= lastDate)
                    .reduce((s, a) => s + a.plannedDays, 0)
                )
              : 0;

            // Since last invoice: allocations after lastInvoiceDate, or all if no date
            let sinceLastInvoice: number;
            if (lastDate) {
              sinceLastInvoice = Math.round(
                allAllocs
                  .filter((a) => budgetProjectIds.has(a.projectId) && new Date(a.weekStartDate) > lastDate)
                  .reduce((s, a) => s + a.plannedDays, 0)
              );
            } else {
              sinceLastInvoice = Math.round(
                allAllocs
                  .filter((a) => budgetProjectIds.has(a.projectId))
                  .reduce((s, a) => s + a.plannedDays, 0)
              );
            }

            return {
              budgetId: budget.id,
              budgetName: budget.name,
              budgetDays: budget.budgetDays,
              lastInvoiceDate: budget.lastInvoiceDate,
              invoicedSoFar,
              remainingDays: budget.budgetDays != null ? Math.round(budget.budgetDays - invoicedSoFar - sinceLastInvoice) : null,
              sinceLastInvoice,
              projects: budgetProjects,
              daysThisMonth: budgetProjects.reduce((s, p) => s + p.daysThisMonth, 0),
            };
          });

          // Unassigned projects (no budget)
          const assignedProjectIds = new Set(clientBudgets.flatMap((b) => (b.projects || []).map((p) => p.id)));
          const unassignedProjects = clientProjects
            .filter((p) => !assignedProjectIds.has(p.id))
            .map(buildProjectNode);

          const clientDaysThisMonth =
            budgetGroups.reduce((s, bg) => s + bg.daysThisMonth, 0) +
            unassignedProjects.reduce((s, p) => s + p.daysThisMonth, 0);

          return { client, budgetGroups, unassignedProjects, clientDaysThisMonth };
        });

        return (
          <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
            <CardHeader className="bg-[#006284] text-white py-3 px-5">
              <CardTitle className="text-base text-white" style={{ fontFamily: "var(--font-poppins)" }}>
                Project Allocation &mdash; {formatMonthYear(year, month)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                    <TableHead className="font-semibold text-[#000] w-[280px]">Client / Budget / Project</TableHead>
                    <TableHead className="text-center font-semibold text-[#000] w-[80px]">Budget</TableHead>
                    <TableHead className="text-center font-semibold text-[#000] w-[80px]">Invoiced</TableHead>
                    <TableHead className="text-center font-semibold text-[#000] w-[100px]">Since Last Invoice</TableHead>
                    <TableHead className="text-center font-semibold text-[#000] w-[90px]">This Month</TableHead>
                    <TableHead className="text-center font-semibold text-[#000] w-[80px]">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectViewData.map((clientNode) => {
                    const clientExpanded = expandedPVClients.has(clientNode.client.id);
                    return (
                      <React.Fragment key={clientNode.client.id}>
                        {/* CLIENT ROW */}
                        <TableRow
                          className="border-b-[#e2e4e7] cursor-pointer transition-colors hover:bg-[#e8f7fa]/60"
                          style={{ borderLeft: "3px solid #006284", backgroundColor: clientExpanded ? "rgba(0,98,132,0.05)" : "white" }}
                          onClick={() => togglePVClient(clientNode.client.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <svg className={`w-4 h-4 text-[#006284] transition-transform ${clientExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{clientNode.client.name}</span>
                              <span className="text-xs text-[#747577]">({clientNode.client.projects?.length || 0} projects)</span>
                            </div>
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-center font-bold text-[#006284]">{clientNode.clientDaysThisMonth}d</TableCell>
                          <TableCell />
                        </TableRow>

                        {/* BUDGET ROWS */}
                        {clientExpanded && clientNode.budgetGroups.map((bg) => {
                          const budgetExpanded = expandedPVBudgets.has(bg.budgetId);
                          return (
                            <React.Fragment key={bg.budgetId}>
                              <TableRow
                                className="border-b-[#e2e4e7] cursor-pointer transition-colors hover:bg-[#e8f7fa]/60 bg-[#f5f6f7]/60"
                                onClick={() => togglePVBudget(bg.budgetId)}
                              >
                                <TableCell className="pl-10">
                                  <div className="flex items-center gap-2">
                                    <svg className={`w-3.5 h-3.5 text-[#006284] transition-transform ${budgetExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="font-semibold text-[#006284]">{bg.budgetName}</span>
                                    <span className="text-[10px] text-[#747577]">({bg.projects.length} projects)</span>
                                    {bg.lastInvoiceDate && (
                                      <span className="text-[10px] text-[#747577] bg-[#f5f6f7] px-1.5 py-0.5 rounded border border-[#e2e4e7]">
                                        Last invoice: {new Date(bg.lastInvoiceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {bg.budgetDays != null ? (
                                    <span className="font-medium text-[#000]">{bg.budgetDays}d</span>
                                  ) : <span className="text-[#e2e4e7]">-</span>}
                                </TableCell>
                                <TableCell className="text-center font-semibold text-[#006284]">
                                  {bg.invoicedSoFar > 0 ? `${bg.invoicedSoFar}d` : <span className="text-[#e2e4e7]">-</span>}
                                </TableCell>
                                <TableCell className="text-center font-semibold text-[#006284]">
                                  {bg.sinceLastInvoice > 0 ? `${bg.sinceLastInvoice}d` : <span className="text-[#e2e4e7]">-</span>}
                                </TableCell>
                                <TableCell className="text-center font-semibold text-[#006284]">
                                  {bg.daysThisMonth > 0 ? `${bg.daysThisMonth}d` : <span className="text-[#e2e4e7]">-</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                  {bg.remainingDays != null ? (
                                    <span className={`font-semibold ${
                                      bg.remainingDays < 0 ? "text-red-600"
                                      : bg.budgetDays && bg.remainingDays < bg.budgetDays * 0.2 ? "text-[#faa61a]"
                                      : "text-[#006284]"
                                    }`}>
                                      {bg.remainingDays}d
                                    </span>
                                  ) : <span className="text-[#e2e4e7]">-</span>}
                                </TableCell>
                              </TableRow>

                              {/* PROJECT ROWS under budget */}
                              {budgetExpanded && bg.projects.map((projNode) => {
                                const projExpanded = expandedPVProjects.has(projNode.project.id);
                                return (
                                  <React.Fragment key={projNode.project.id}>
                                    <TableRow
                                      className={`border-b-[#e2e4e7] cursor-pointer transition-colors hover:bg-[#e8f7fa]/60 ${projExpanded ? "bg-[#fafbfc]" : "bg-white"}`}
                                      onClick={() => togglePVProject(projNode.project.id)}
                                    >
                                      <TableCell className="pl-20">
                                        <div className="flex items-center gap-2">
                                          <svg className={`w-3 h-3 text-[#87d3df] transition-transform ${projExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                          </svg>
                                          <span className="font-medium text-[#000]">{projNode.project.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell />
                                      <TableCell className="text-center text-sm text-[#000]">
                                        {projNode.usedDays > 0 ? `${projNode.usedDays}d` : <span className="text-[#e2e4e7]">-</span>}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell className="text-center text-sm text-[#006284]">
                                        {projNode.daysThisMonth > 0 ? `${projNode.daysThisMonth}d` : <span className="text-[#e2e4e7]">-</span>}
                                      </TableCell>
                                      <TableCell />
                                    </TableRow>

                                    {/* EMPLOYEE ROWS under project */}
                                    {projExpanded && projNode.employees.map((empEntry) => (
                                      <TableRow key={`${projNode.project.id}-${empEntry.employee!.id}`} className="border-b-[#e2e4e7] bg-[#f5f6f7]/50">
                                        <TableCell className="pl-28">
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="text-[#87d3df]">&bull;</span>
                                            <span className="text-[#000]">{empEntry.employee!.name}</span>
                                            <span className="text-[10px] text-[#747577]">({empEntry.employee!.role})</span>
                                          </div>
                                        </TableCell>
                                        <TableCell />
                                        <TableCell />
                                        <TableCell />
                                        <TableCell className="text-center text-sm text-[#000]">{empEntry.days}d</TableCell>
                                        <TableCell />
                                      </TableRow>
                                    ))}

                                    {projExpanded && projNode.employees.length === 0 && (
                                      <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]/30">
                                        <TableCell colSpan={6} className="text-center py-2 text-[#747577] text-xs pl-28">
                                          No allocations this month.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}

                        {/* UNASSIGNED PROJECTS (no budget) */}
                        {clientExpanded && clientNode.unassignedProjects.length > 0 && (
                          <>
                            {clientNode.budgetGroups.length > 0 && (
                              <TableRow className="border-b-[#e2e4e7] bg-[#fafbfc]">
                                <TableCell className="pl-10" colSpan={6}>
                                  <span className="text-xs font-semibold text-[#747577]">Unassigned Projects</span>
                                </TableCell>
                              </TableRow>
                            )}
                            {clientNode.unassignedProjects.map((projNode) => {
                              const projExpanded = expandedPVProjects.has(projNode.project.id);
                              return (
                                <React.Fragment key={projNode.project.id}>
                                  <TableRow
                                    className={`border-b-[#e2e4e7] cursor-pointer transition-colors hover:bg-[#e8f7fa]/60 ${projExpanded ? "bg-[#fafbfc]" : "bg-white"}`}
                                    onClick={() => togglePVProject(projNode.project.id)}
                                  >
                                    <TableCell className="pl-10">
                                      <div className="flex items-center gap-2">
                                        <svg className={`w-3.5 h-3.5 text-[#87d3df] transition-transform ${projExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="font-medium text-[#000]">{projNode.project.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {projNode.project.budgetDays != null ? (
                                        <span className="font-medium text-[#000]">{projNode.project.budgetDays}d</span>
                                      ) : <span className="text-[#e2e4e7]">-</span>}
                                    </TableCell>
                                    <TableCell className="text-center text-sm text-[#000]">
                                      {projNode.usedDays > 0 ? `${projNode.usedDays}d` : <span className="text-[#e2e4e7]">-</span>}
                                    </TableCell>
                                    <TableCell />
                                    <TableCell className="text-center text-sm text-[#006284]">
                                      {projNode.daysThisMonth > 0 ? `${projNode.daysThisMonth}d` : <span className="text-[#e2e4e7]">-</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {projNode.project.budgetDays != null ? (
                                        <span className={`font-semibold ${
                                          Math.round(projNode.project.budgetDays - projNode.usedDays) < 0 ? "text-red-600" : "text-[#006284]"
                                        }`}>
                                          {Math.round(projNode.project.budgetDays - projNode.usedDays)}d
                                        </span>
                                      ) : <span className="text-[#e2e4e7]">-</span>}
                                    </TableCell>
                                  </TableRow>

                                  {projExpanded && projNode.employees.map((empEntry) => (
                                    <TableRow key={`${projNode.project.id}-${empEntry.employee!.id}`} className="border-b-[#e2e4e7] bg-[#f5f6f7]/50">
                                      <TableCell className="pl-20">
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="text-[#87d3df]">&bull;</span>
                                          <span className="text-[#000]">{empEntry.employee!.name}</span>
                                          <span className="text-[10px] text-[#747577]">({empEntry.employee!.role})</span>
                                        </div>
                                      </TableCell>
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell className="text-center text-sm text-[#000]">{empEntry.days}d</TableCell>
                                      <TableCell />
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {projectViewData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-[#747577]">
                        No active projects. Add them in Manage.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

// ── Inline-editable cell ──
function InlineEdit({
  value,
  onSave,
  className = "",
  suffix = "d",
  step = 1,
}: {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  className?: string;
  suffix?: string;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(value.toString()); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const newVal = Math.round(parseFloat(editValue) || 0);
    if (editValue !== value.toString()) {
      setSaving(true);
      await onSave(newVal);
      setSaving(false);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={0}
        step={step}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setEditing(false); setEditValue(value.toString()); }
        }}
        className="w-16 mx-auto text-center border-[#87d3df] ring-1 ring-[#87d3df] h-7 text-sm"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`px-2 py-0.5 rounded hover:bg-[#e8f7fa] transition-colors ${saving ? "opacity-50" : ""} ${className}`}
    >
      {value}{suffix}
    </button>
  );
}
