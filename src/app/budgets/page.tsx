"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Project, Client, Allocation } from "@/lib/types";

interface ProjectWithAllocations extends Project {
  client: Client;
  totalPlannedDays: number;
}

export default function BudgetsPage() {
  const [projects, setProjects] = useState<ProjectWithAllocations[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [projectsRes, allocationsRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/allocations"),
    ]);
    const projectsData: (Project & { client: Client })[] = await projectsRes.json();
    const allocationsData: Allocation[] = await allocationsRes.json();

    const allocationsByProject = new Map<string, number>();
    for (const a of allocationsData) {
      allocationsByProject.set(
        a.projectId,
        (allocationsByProject.get(a.projectId) || 0) + a.plannedDays
      );
    }

    const enriched = projectsData.map((p) => ({
      ...p,
      totalPlannedDays: allocationsByProject.get(p.id) || 0,
    }));

    setProjects(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  const byClient = new Map<string, { client: Client; projects: ProjectWithAllocations[] }>();
  for (const p of projects) {
    if (!byClient.has(p.clientId)) {
      byClient.set(p.clientId, { client: p.client, projects: [] });
    }
    byClient.get(p.clientId)!.projects.push(p);
  }

  // Summary stats
  const totalPlannedDays = projects.reduce((s, p) => s + p.totalPlannedDays, 0);
  const totalPlannedValue = projects.reduce((s, p) => s + (p.dayRate ? p.totalPlannedDays * p.dayRate : 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>Budgets</h2>
        <p className="text-sm text-[#747577] mt-1">
          Budget and invoice data from Fabric. Planned allocations from this app.
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#006284]">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{totalPlannedDays}d</div>
                <div className="text-sm text-[#747577]">Total Planned Days</div>
              </CardContent>
            </Card>
            <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#87d3df]">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>
                  {totalPlannedValue > 0 ? `\u20AC${totalPlannedValue.toLocaleString()}` : "-"}
                </div>
                <div className="text-sm text-[#747577]">Planned Value (EUR)</div>
              </CardContent>
            </Card>
            <Card className="border-[#e2e4e7] shadow-sm border-l-4 border-l-[#faa61a]">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[#faa61a]" style={{ fontFamily: "var(--font-poppins)" }}>
                  Connect Fabric
                </div>
                <div className="text-sm text-[#747577]">Budget vs. Actual</div>
              </CardContent>
            </Card>
          </div>

          {/* Per-client budget tables */}
          {Array.from(byClient).map(([clientId, { client, projects: clientProjects }]) => {
            const clientTotalDays = clientProjects.reduce((s, p) => s + p.totalPlannedDays, 0);
            const clientTotalValue = clientProjects.reduce((s, p) => s + (p.dayRate ? p.totalPlannedDays * p.dayRate : 0), 0);

            return (
              <Card key={clientId} className="border-[#e2e4e7] shadow-sm overflow-hidden">
                <CardHeader className="bg-[#006284] text-white py-3 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white" style={{ fontFamily: "var(--font-poppins)" }}>
                      {client.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-[#87d3df]">
                        {clientTotalDays}d planned
                      </span>
                      {clientTotalValue > 0 && (
                        <span className="text-[#87d3df]">
                          {"\u20AC"}{clientTotalValue.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                        <TableHead className="font-semibold text-[#000]">Project</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Day Rate</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Planned Days</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Planned Value</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Budget (Fabric)</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Remaining</TableHead>
                        <TableHead className="text-center font-semibold text-[#000]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientProjects.map((proj) => {
                        const plannedValue = proj.dayRate
                          ? proj.totalPlannedDays * proj.dayRate
                          : null;
                        return (
                          <TableRow key={proj.id} className="border-b-[#e2e4e7]">
                            <TableCell className="font-medium text-[#000]">{proj.name}</TableCell>
                            <TableCell className="text-center text-[#747577]">
                              {proj.dayRate ? `\u20AC${proj.dayRate.toLocaleString()}` : "-"}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-[#006284]">{proj.totalPlannedDays}d</TableCell>
                            <TableCell className="text-center text-[#747577]">
                              {plannedValue ? `\u20AC${plannedValue.toLocaleString()}` : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-[#87d3df] text-xs italic">Fabric</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-[#87d3df] text-xs italic">Fabric</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-[#f5f6f7] text-[#747577] border border-[#e2e4e7] text-[10px]">
                                Pending
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          {projects.length === 0 && (
            <div className="text-center text-[#747577] py-12">
              <p className="text-lg font-semibold text-[#000] mb-1" style={{ fontFamily: "var(--font-poppins)" }}>No projects yet</p>
              <p>Add clients and projects in the Manage section.</p>
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
                    <TableHead className="text-center font-semibold text-[#000]">EUR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-[#747577]">
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
                Combined view matching your Power BI dashboard structure.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                    <TableHead className="font-semibold text-[#000]">Customer</TableHead>
                    <TableHead className="font-semibold text-[#000]">Budget Name</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Start Date</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">End Date</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Budget Hours</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Invoiced</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Actuals since Invoice</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Remaining</TableHead>
                    <TableHead className="text-center font-semibold text-[#000]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((proj) => (
                    <TableRow key={proj.id} className="border-b-[#e2e4e7]">
                      <TableCell className="text-[#000] font-medium">{proj.client.name}</TableCell>
                      <TableCell className="text-[#000]">{proj.name}</TableCell>
                      <TableCell className="text-center text-[#87d3df] text-xs italic">Fabric</TableCell>
                      <TableCell className="text-center text-[#87d3df] text-xs italic">Fabric</TableCell>
                      <TableCell className="text-center text-[#87d3df] text-xs italic">Fabric</TableCell>
                      <TableCell className="text-center text-[#87d3df] text-xs italic">Fabric</TableCell>
                      <TableCell className="text-center text-[#87d3df] text-xs italic">Fabric</TableCell>
                      <TableCell className="text-center text-[#87d3df] text-xs italic">Fabric</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-[#f5f6f7] text-[#747577] border border-[#e2e4e7] text-[10px]">
                          Pending
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {projects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-[#747577]">
                        No projects configured yet.
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
