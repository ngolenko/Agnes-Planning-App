"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Budget, Client, Project, Allocation } from "@/lib/types";
import { formatMonthYear } from "@/lib/dates";

interface BudgetWithAllocations extends Budget {
  client: Client;
  projects: Project[];
  totalUsedDays: number;
  plannedThisMonth: number;
  projectUsed: Map<string, number>;
  projectPlannedMonth: Map<string, number>;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithAllocations[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBudgets, setExpandedBudgets] = useState<Set<string>>(new Set());
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [budgetsRes, allocationsRes] = await Promise.all([
      fetch("/api/budgets"),
      fetch("/api/allocations"),
    ]);
    const budgetsData: (Budget & { client: Client; projects: Project[] })[] = await budgetsRes.json();
    const allocationsData: Allocation[] = await allocationsRes.json();

    // All-time allocations by project
    const allTimeByProject = new Map<string, number>();
    for (const a of allocationsData) {
      allTimeByProject.set(
        a.projectId,
        (allTimeByProject.get(a.projectId) || 0) + a.plannedDays
      );
    }

    // Current month allocations by project
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthByProject = new Map<string, number>();
    for (const a of allocationsData) {
      const ws = typeof a.weekStartDate === "string" ? a.weekStartDate : (a.weekStartDate as Date).toISOString();
      if (ws.startsWith(monthStr)) {
        monthByProject.set(
          a.projectId,
          (monthByProject.get(a.projectId) || 0) + a.plannedDays
        );
      }
    }

    const enriched: BudgetWithAllocations[] = budgetsData.map((b) => {
      const projectIds = (b.projects || []).map((p) => p.id);
      const totalUsedDays = projectIds.reduce((s, pid) => s + (allTimeByProject.get(pid) || 0), 0);
      const plannedThisMonth = projectIds.reduce((s, pid) => s + (monthByProject.get(pid) || 0), 0);
      const projectUsed = new Map<string, number>();
      const projectPlannedMonth = new Map<string, number>();
      for (const pid of projectIds) {
        projectUsed.set(pid, allTimeByProject.get(pid) || 0);
        projectPlannedMonth.set(pid, monthByProject.get(pid) || 0);
      }
      return { ...b, totalUsedDays, plannedThisMonth, projectUsed, projectPlannedMonth };
    });

    setBudgets(enriched);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-[#747577]">
        <svg className="animate-spin h-5 w-5 text-[#006284]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading budgets...
      </div>
    );
  }

  // Group by client
  const byClient = new Map<string, { client: Client; budgets: BudgetWithAllocations[] }>();
  for (const b of budgets) {
    if (!byClient.has(b.clientId)) {
      byClient.set(b.clientId, { client: b.client, budgets: [] });
    }
    byClient.get(b.clientId)!.budgets.push(b);
  }

  // Summary stats
  const totalBudgetDays = Math.round(budgets.reduce((s, b) => s + (b.budgetDays || 0), 0));
  const totalUsedDays = Math.round(budgets.reduce((s, b) => s + b.totalUsedDays, 0));
  const totalPlannedMonth = Math.round(budgets.reduce((s, b) => s + b.plannedThisMonth, 0));
  const totalRemaining = totalBudgetDays - totalUsedDays;

  const toggleBudget = (id: string) => {
    setExpandedBudgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>Budgets</h2>
          <p className="text-sm text-[#747577] mt-1">
            Budget and invoice data from Fabric. Planned allocations from this app.
          </p>
        </div>
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

      <Tabs defaultValue="budgets" className="w-full">
        <TabsList className="bg-[#f5f6f7] border border-[#e2e4e7]">
          <TabsTrigger value="budgets" className="data-[state=active]:bg-[#006284] data-[state=active]:text-white font-medium" style={{ fontFamily: "var(--font-poppins)" }}>
            Budgets
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-[#006284] data-[state=active]:text-white font-medium" style={{ fontFamily: "var(--font-poppins)" }}>
            Invoices
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-[#006284] data-[state=active]:text-white font-medium" style={{ fontFamily: "var(--font-poppins)" }}>
            All Budgets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#006284]">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{totalBudgetDays}d</div>
                <div className="text-xs text-[#747577]">Total Budget</div>
              </CardContent>
            </Card>
            <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#87d3df]">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>
                  {totalUsedDays}d
                </div>
                <div className="text-xs text-[#747577]">Used So Far</div>
              </CardContent>
            </Card>
            <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#006284]">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>
                  {totalPlannedMonth}d
                </div>
                <div className="text-xs text-[#747577]">Planned {formatMonthYear(year, month)}</div>
              </CardContent>
            </Card>
            <Card className={`border-[#e2e4e7] shadow-sm border-l-4 ${totalRemaining < 0 ? "border-l-red-500" : totalRemaining < totalBudgetDays * 0.2 ? "border-l-[#faa61a]" : "border-l-[#006284]"}`}>
              <CardContent className="pt-5 pb-4">
                <div className={`text-2xl font-bold ${totalRemaining < 0 ? "text-red-600" : totalRemaining < totalBudgetDays * 0.2 ? "text-[#faa61a]" : "text-[#006284]"}`} style={{ fontFamily: "var(--font-poppins)" }}>
                  {totalRemaining}d
                </div>
                <div className="text-xs text-[#747577]">Remaining</div>
              </CardContent>
            </Card>
          </div>

          {/* Per-client budget cards */}
          {Array.from(byClient).map(([clientId, { client, budgets: clientBudgets }]) => {
            const clientTotalBudgetDays = clientBudgets.reduce((s, b) => s + (b.budgetDays || 0), 0);
            const clientTotalUsed = Math.round(clientBudgets.reduce((s, b) => s + b.totalUsedDays, 0));
            const clientPlannedMonth = Math.round(clientBudgets.reduce((s, b) => s + b.plannedThisMonth, 0));

            return (
              <Card key={clientId} className="border-[#e2e4e7] shadow-sm overflow-hidden">
                <CardHeader className="bg-[#006284] text-white py-3 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white" style={{ fontFamily: "var(--font-poppins)" }}>
                      {client.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-[#87d3df]">
                        {clientBudgets.length} budget{clientBudgets.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[#87d3df]">
                        {clientTotalUsed}d / {Math.round(clientTotalBudgetDays)}d
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                        <TableHead className="font-semibold text-[#000]">Budget</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Total Budget</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Used So Far</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Planned {formatMonthYear(year, month)}</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Remaining</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientBudgets.map((budget) => {
                        const remaining = budget.budgetDays != null ? Math.round(budget.budgetDays - budget.totalUsedDays) : null;
                        const isExpanded = expandedBudgets.has(budget.id);
                        return (
                          <React.Fragment key={budget.id}>
                            <TableRow
                              className="border-b-[#e2e4e7] cursor-pointer hover:bg-[#e8f7fa]/60"
                              onClick={() => toggleBudget(budget.id)}
                            >
                              <TableCell className="font-medium text-[#000]">
                                <div className="flex items-center gap-2">
                                  <svg className={`w-4 h-4 text-[#006284] transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                  {budget.name}
                                  <span className="text-xs text-[#747577]">({budget.projects?.length || 0} projects)</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium text-[#000]">
                                {budget.budgetDays != null ? `${budget.budgetDays}d` : "-"}
                              </TableCell>
                              <TableCell className="text-center font-semibold text-[#006284]">
                                {Math.round(budget.totalUsedDays)}d
                              </TableCell>
                              <TableCell className="text-center font-medium text-[#006284]">
                                {Math.round(budget.plannedThisMonth)}d
                              </TableCell>
                              <TableCell className="text-center">
                                {remaining != null ? (
                                  <span className={`font-semibold ${
                                    remaining < 0 ? "text-red-600" :
                                    budget.budgetDays && remaining < budget.budgetDays * 0.2 ? "text-[#faa61a]" :
                                    "text-[#006284]"
                                  }`}>
                                    {remaining}d
                                  </span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                {remaining != null && remaining < 0 ? (
                                  <Badge className="bg-red-100 text-red-700 border border-red-200 text-[10px]">Over Budget</Badge>
                                ) : remaining != null && budget.budgetDays && remaining < budget.budgetDays * 0.2 ? (
                                  <Badge className="bg-[#faa61a]/10 text-[#faa61a] border border-[#faa61a]/20 text-[10px]">Low</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-[#006284]/10 text-[#006284] border border-[#006284]/20 text-[10px]">On Track</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (budget.projects || []).map((proj) => {
                              const projUsed = Math.round(budget.projectUsed.get(proj.id) || 0);
                              const projPlanned = Math.round(budget.projectPlannedMonth.get(proj.id) || 0);
                              return (
                                <TableRow key={`${budget.id}-${proj.id}`} className="bg-[#f5f6f7]/50 border-b-[#e2e4e7]">
                                  <TableCell className="pl-12">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-[#87d3df]">&bull;</span>
                                      <span className="text-[#000]">{proj.name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell />
                                  <TableCell className="text-center text-sm text-[#747577]">
                                    {projUsed > 0 ? `${projUsed}d` : "-"}
                                  </TableCell>
                                  <TableCell className="text-center text-sm text-[#747577]">
                                    {projPlanned > 0 ? `${projPlanned}d` : "-"}
                                  </TableCell>
                                  <TableCell />
                                  <TableCell />
                                </TableRow>
                              );
                            })}
                            {isExpanded && (!budget.projects || budget.projects.length === 0) && (
                              <TableRow key={`${budget.id}-empty`} className="bg-[#f5f6f7]/30">
                                <TableCell colSpan={6} className="text-center py-2 text-[#747577] text-xs pl-12">
                                  No projects in this budget
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          {budgets.length === 0 && (
            <div className="text-center text-[#747577] py-12">
              <p className="text-lg font-semibold text-[#000] mb-1" style={{ fontFamily: "var(--font-poppins)" }}>No budgets yet</p>
              <p>Add clients and budgets in the Manage section.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card className="border-[#e2e4e7] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>Invoices</CardTitle>
              <p className="text-sm text-[#747577]">
                Invoice data will be pulled from your Fabric SQL endpoint once connected.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                    <TableHead className="font-semibold text-[#000]">Invoice Number</TableHead>
                    <TableHead className="font-semibold text-[#000]">Customer</TableHead>
                    <TableHead className="font-semibold text-[#000]">Budget</TableHead>
                    <TableHead className="font-semibold text-[#000]">Project</TableHead>
                    <TableHead className="font-semibold text-[#000]">Invoice Date</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Period</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-[#747577]">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-[#87d3df]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <p className="font-medium text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>Connect to Fabric</p>
                        <p className="text-sm">Invoice data will appear here once the Fabric SQL endpoint is configured.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card className="border-[#e2e4e7] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>All Budgets Overview</CardTitle>
              <p className="text-sm text-[#747577]">
                Combined view of all budgets across clients.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                    <TableHead className="font-semibold text-[#000]">Customer</TableHead>
                    <TableHead className="font-semibold text-[#000]">Budget Name</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Total Budget</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Used So Far</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Planned {formatMonthYear(year, month)}</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Remaining</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Projects</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => {
                    const remaining = budget.budgetDays != null ? Math.round(budget.budgetDays - budget.totalUsedDays) : null;
                    return (
                      <TableRow key={budget.id} className="border-b-[#e2e4e7]">
                        <TableCell className="text-[#000] font-medium">{budget.client.name}</TableCell>
                        <TableCell className="text-[#000]">{budget.name}</TableCell>
                        <TableCell className="text-center font-medium text-[#000]">
                          {budget.budgetDays != null ? `${budget.budgetDays}d` : "-"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-[#006284]">
                          {Math.round(budget.totalUsedDays)}d
                        </TableCell>
                        <TableCell className="text-center font-medium text-[#006284]">
                          {Math.round(budget.plannedThisMonth)}d
                        </TableCell>
                        <TableCell className="text-center">
                          {remaining != null ? (
                            <span className={`font-semibold ${
                              remaining < 0 ? "text-red-600" :
                              budget.budgetDays && remaining < budget.budgetDays * 0.2 ? "text-[#faa61a]" :
                              "text-[#006284]"
                            }`}>
                              {remaining}d
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-center text-[#747577]">
                          {budget.projects?.length || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {remaining != null && remaining < 0 ? (
                            <Badge className="bg-red-100 text-red-700 border border-red-200 text-[10px]">Over Budget</Badge>
                          ) : remaining != null && budget.budgetDays && remaining < budget.budgetDays * 0.2 ? (
                            <Badge className="bg-[#faa61a]/10 text-[#faa61a] border border-[#faa61a]/20 text-[10px]">Low</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-[#006284]/10 text-[#006284] border border-[#006284]/20 text-[10px]">On Track</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {budgets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-[#747577]">
                        No budgets configured yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
