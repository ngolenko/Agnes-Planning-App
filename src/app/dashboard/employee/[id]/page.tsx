"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanningData, Employee } from "@/lib/types";
import { getWorkingDaysInMonth, formatMonthYear } from "@/lib/dates";
import { getEmployeeAvailableDays, daysToPercentage } from "@/lib/availability";

export default function EmployeePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const now = new Date();
  const [year, setYear] = useState(
    searchParams.get("year") ? parseInt(searchParams.get("year")!) : now.getFullYear()
  );
  const [month, setMonth] = useState(
    searchParams.get("month") ? parseInt(searchParams.get("month")!) : now.getMonth()
  );

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [empRes, planRes] = await Promise.all([
      fetch(`/api/employees/${employeeId}`, { cache: "no-store" }),
      fetch(`/api/planning?year=${year}&month=${month}`, { cache: "no-store" }),
    ]);
    if (empRes.ok) setEmployee(await empRes.json());
    if (planRes.ok) setData(await planRes.json());
    setLoading(false);
  }, [employeeId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update URL when month changes
  useEffect(() => {
    const url = `/dashboard/employee/${employeeId}?year=${year}&month=${month}`;
    router.replace(url, { scroll: false });
  }, [year, month, employeeId, router]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  if (loading || !data || !employee) {
    return (
      <div className="p-8 flex items-center gap-3 text-[#747577]">
        <svg className="animate-spin h-5 w-5 text-[#006284]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading employee data...
      </div>
    );
  }

  const workingDays = getWorkingDaysInMonth(year, month);
  const empTimeOff = data.timeOff.filter((t) => t.employeeId === employeeId);
  const empUnbillable = data.unbillable.filter((u) => u.employeeId === employeeId);
  const empAllocations = data.allocations.filter((a) => a.employeeId === employeeId);

  const timeOffDays = empTimeOff.length;
  const unbillableDays = Math.round(empUnbillable.reduce((s, u) => s + u.plannedDays, 0));
  const available = getEmployeeAvailableDays(employeeId, workingDays, data.timeOff, data.unbillable);
  const totalPlanned = Math.round(empAllocations.reduce((s, a) => s + a.plannedDays, 0));
  const utilization = available > 0 ? Math.round((totalPlanned / available) * 100) : 0;

  // Group allocations by client
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
  // Round all day values
  for (const entry of clientMap.values()) {
    entry.totalDays = Math.round(entry.totalDays);
    for (const p of entry.projects) {
      p.days = Math.round(p.days);
    }
  }
  const clientGroups = Array.from(clientMap.values()).sort((a, b) => b.totalDays - a.totalDays);

  // Format date for time off table
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const timeOffLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Vacation";
      case "sick": return "Sick";
      case "public_holiday": return "Holiday";
      default: return type;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-[#006284]/10 text-[#006284]";
      case "planned": return "bg-[#faa61a]/10 text-[#faa61a]";
      default: return "bg-[#747577]/10 text-[#747577]";
    }
  };

  // Unbillable breakdown
  const unbillableByCategory: Record<string, number> = {};
  for (const u of empUnbillable) {
    unbillableByCategory[u.category] = (unbillableByCategory[u.category] || 0) + u.plannedDays;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#006284] hover:text-[#004d68] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Header with employee name and month nav */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>
            {employee.name}
          </h2>
          <p className="text-sm text-[#747577]">{employee.role}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth} className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <span className="font-semibold min-w-[160px] text-center text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
            {formatMonthYear(year, month)}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth} className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#006284]">
          <CardContent className="pt-5 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{workingDays}d</div>
                <div className="text-xs text-[#747577]">Working Days</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>{available}d</div>
                <div className="text-xs text-[#747577]">Available</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#faa61a]">
          <CardContent className="pt-5 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-[#faa61a]" style={{ fontFamily: "var(--font-poppins)" }}>{timeOffDays}d</div>
                <div className="text-xs text-[#747577]">Time Off</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#87d3df]" style={{ fontFamily: "var(--font-poppins)" }}>{unbillableDays}d</div>
                <div className="text-xs text-[#747577]">Unbillable</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-[#e2e4e7] shadow-sm border-l-4 ${utilization > 100 ? "border-l-red-500" : utilization >= 80 ? "border-l-[#006284]" : "border-l-[#faa61a]"}`}>
          <CardContent className="pt-5 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className={`text-2xl font-bold ${totalPlanned > available ? "text-red-600" : "text-[#006284]"}`} style={{ fontFamily: "var(--font-poppins)" }}>{totalPlanned}d</div>
                <div className="text-xs text-[#747577]">Allocated</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${utilization > 100 ? "text-red-600" : utilization >= 80 ? "text-[#006284]" : "text-[#faa61a]"}`} style={{ fontFamily: "var(--font-poppins)" }}>
                  {utilization}%
                </div>
                <div className="text-xs text-[#747577]">Utilization</div>
                {/* Utilization bar */}
                <div className="w-full h-1 bg-[#e2e4e7] rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(utilization, 100)}%`,
                      backgroundColor: utilization > 100 ? "#dc2626" : "#006284",
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Allocations */}
      <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
        <div className="bg-[#006284] text-white py-3 px-5">
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-poppins)" }}>
            Client Allocations
          </h3>
        </div>
        {clientGroups.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                <TableHead className="font-semibold text-[#000]">Client / Project</TableHead>
                <TableHead className="text-center font-semibold text-[#000] w-[100px]">Alloc %</TableHead>
                <TableHead className="text-center font-semibold text-[#000] w-[80px]">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientGroups.map((cg) => {
                const isExpanded = expandedClients.has(cg.clientId);
                const allocPct = daysToPercentage(Math.round(cg.totalDays), available);
                return (
                  <React.Fragment key={cg.clientId}>
                    <TableRow
                      className="border-b-[#e2e4e7] cursor-pointer hover:bg-[#e8f7fa]/60 transition-colors"
                      onClick={() => toggleClient(cg.clientId)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <svg className={`w-4 h-4 text-[#006284] transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-semibold text-[#000]">{cg.clientName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-[#006284]/10 text-[#006284] border-0">{allocPct}%</Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-[#006284]">
                        {Math.round(cg.totalDays)}d
                      </TableCell>
                    </TableRow>
                    {isExpanded && cg.projects.sort((a, b) => b.days - a.days).map((proj) => (
                      <TableRow key={proj.projectId} className="bg-[#f5f6f7]/50 border-b-[#e2e4e7]">
                        <TableCell className="pl-12">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-[#87d3df]">&bull;</span>
                            <span className="text-[#000]">{proj.projectName}</span>
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-center text-[#006284] font-medium">
                          {Math.round(proj.days)}d
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-[#747577] text-sm">
            No project allocations this month
          </div>
        )}
      </Card>

      {/* Unbillable Breakdown */}
      {Object.keys(unbillableByCategory).length > 0 && (
        <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
          <div className="bg-[#87d3df] text-[#004d68] py-3 px-5">
            <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
              Unbillable Time
            </h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-4">
              {Object.entries(unbillableByCategory).map(([category, days]) => (
                <div key={category} className="flex items-center gap-2 text-sm">
                  <span className="capitalize font-medium text-[#004d68]">{category}:</span>
                  <span className="text-[#747577]">{Math.round(days)}d</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Non-Working Days Table */}
      {empTimeOff.length > 0 && (
        <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
          <div className="bg-[#faa61a] text-white py-3 px-5">
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-poppins)" }}>
              Non-Working Days
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                <TableHead className="font-semibold text-[#000]">Date</TableHead>
                <TableHead className="font-semibold text-[#000]">Type</TableHead>
                <TableHead className="font-semibold text-[#000]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empTimeOff
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((t) => (
                  <TableRow key={t.id} className="border-b-[#e2e4e7]">
                    <TableCell className="text-[#000]">{formatDate(t.date)}</TableCell>
                    <TableCell>
                      <Badge className={`border-0 ${
                        t.type === "vacation" ? "bg-[#006284]/10 text-[#006284]" :
                        t.type === "sick" ? "bg-red-50 text-red-600" :
                        "bg-[#faa61a]/10 text-[#faa61a]"
                      }`}>
                        {timeOffLabel(t.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 capitalize ${statusColor(t.status)}`}>
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
