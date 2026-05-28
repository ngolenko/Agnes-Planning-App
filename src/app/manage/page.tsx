"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Employee, Client, Project, Budget, Allocation } from "@/lib/types";

export default function ManagePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<(Client & { projects: Project[] })[]>([]);
  const [budgets, setBudgets] = useState<(Budget & { client: Client; projects: Project[] })[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [monthAllocations, setMonthAllocations] = useState<Allocation[]>([]);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Form state
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empCapacity, setEmpCapacity] = useState("5");
  const [empCountry, setEmpCountry] = useState("DE");
  const [clientName, setClientName] = useState("");
  const [projName, setProjName] = useState("");
  const [projClientId, setProjClientId] = useState("");
  const [projBudgetId, setProjBudgetId] = useState("");
  const [projBudgetDays, setProjBudgetDays] = useState("");
  const [budgetName, setBudgetName] = useState("");
  const [budgetClientId, setBudgetClientId] = useState("");
  const [budgetDays, setBudgetDays] = useState("");

  const fetchData = useCallback(async () => {
    const [empRes, clientRes, budgetRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/clients"),
      fetch("/api/budgets"),
    ]);
    setEmployees(await empRes.json());
    setClients(await clientRes.json());
    setBudgets(await budgetRes.json());
    // Fetch all allocations for budget remaining calculation
    const planRes = await fetch(`/api/planning?year=${new Date().getFullYear()}&month=${new Date().getMonth()}`);
    const planData = await planRes.json();
    setAllocations(planData.allAllocations || []);
    setMonthAllocations(planData.allocations || []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveEmployee = async () => {
    const body = { name: empName, email: empEmail, role: empRole, country: empCountry, weeklyCapacityDays: parseFloat(empCapacity) || 5 };
    if (editingEmployee) {
      await fetch(`/api/employees/${editingEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setShowEmployeeDialog(false);
    setEditingEmployee(null);
    setEmpName("");
    setEmpEmail("");
    setEmpRole("");
    setEmpCapacity("5");
    fetchData();
  };

  const deleteEmployee = async (id: string) => {
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    fetchData();
  };

  const saveClient = async () => {
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clientName }),
    });
    setShowClientDialog(false);
    setClientName("");
    fetchData();
  };

  const deleteClient = async (id: string) => {
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    fetchData();
  };

  const saveBudget = async () => {
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: budgetName,
        clientId: budgetClientId,
        budgetDays: budgetDays ? parseFloat(budgetDays) : null,
      }),
    });
    setShowBudgetDialog(false);
    setBudgetName("");
    setBudgetClientId("");
    setBudgetDays("");
    fetchData();
  };

  const deleteBudget = async (id: string) => {
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    fetchData();
  };

  const saveProject = async () => {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projName,
        clientId: projClientId,
        budgetId: projBudgetId && projBudgetId !== "none" ? projBudgetId : null,
        budgetDays: projBudgetDays ? parseFloat(projBudgetDays) : null,
      }),
    });
    setShowProjectDialog(false);
    setProjName("");
    setProjClientId("");
    setProjBudgetId("");
    setProjBudgetDays("");
    fetchData();
  };

  const deleteProject = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    fetchData();
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpEmail(emp.email);
    setEmpRole(emp.role);
    setEmpCountry(emp.country || "DE");
    setEmpCapacity(emp.weeklyCapacityDays.toString());
    setShowEmployeeDialog(true);
  };

  // Helper: get budgets for a specific client
  const getBudgetsForClient = (clientId: string) => budgets.filter((b) => b.clientId === clientId);

  // Helper: get projects assigned to a budget
  const getProjectsForBudget = (budgetId: string) => {
    const budget = budgets.find((b) => b.id === budgetId);
    return budget?.projects || [];
  };

  // Helper: get unassigned projects (no budget) for a client
  const getUnassignedProjects = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client?.projects) return [];
    return client.projects.filter((p) => !p.budgetId);
  };

  // Helper: invoiced days for a project (up to lastInvoiceDate)
  const getProjectInvoicedDays = (projectId: string, lastInvoiceDate: Date | null) => {
    if (!lastInvoiceDate) return 0;
    return Math.round(
      allocations
        .filter((a) => a.projectId === projectId && new Date(a.weekStartDate) <= lastInvoiceDate)
        .reduce((s, a) => s + a.plannedDays, 0)
    );
  };

  // Helper: invoiced days for a budget (sum across all projects, up to lastInvoiceDate)
  const getBudgetInvoicedDays = (budget: Budget) => {
    const budgetProjects = getProjectsForBudget(budget.id);
    const lastInvoiceDate = budget.lastInvoiceDate ? new Date(budget.lastInvoiceDate) : null;
    return budgetProjects.reduce((s, p) => s + getProjectInvoicedDays(p.id, lastInvoiceDate), 0);
  };

  // Helper: planned this month for a budget
  const getBudgetPlannedThisMonth = (budgetId: string) => {
    const budgetProjects = getProjectsForBudget(budgetId);
    return Math.round(
      monthAllocations
        .filter((a) => budgetProjects.some((p) => p.id === a.projectId))
        .reduce((s, a) => s + a.plannedDays, 0)
    );
  };

  // Helper: allocations since last invoice for a budget
  const getBudgetSinceLastInvoice = (budget: Budget) => {
    const budgetProjects = getProjectsForBudget(budget.id);
    const lastInvoiceDate = budget.lastInvoiceDate ? new Date(budget.lastInvoiceDate) : null;
    if (lastInvoiceDate) {
      return Math.round(
        allocations
          .filter((a) => budgetProjects.some((p) => p.id === a.projectId) && new Date(a.weekStartDate) > lastInvoiceDate)
          .reduce((s, a) => s + a.plannedDays, 0)
      );
    }
    // Fallback: current month
    return Math.round(
      monthAllocations
        .filter((a) => budgetProjects.some((p) => p.id === a.projectId))
        .reduce((s, a) => s + a.plannedDays, 0)
    );
  };

  // Helper: total allocations ever for a budget (used for remaining calculation)
  const getBudgetTotalUsed = (budget: Budget) => {
    const budgetProjects = getProjectsForBudget(budget.id);
    return Math.round(
      allocations
        .filter((a) => budgetProjects.some((p) => p.id === a.projectId))
        .reduce((s, a) => s + a.plannedDays, 0)
    );
  };

  // Helper: allocations since last invoice for a project within a budget
  const getProjectSinceLastInvoice = (projectId: string, budget: Budget) => {
    const lastInvoiceDate = budget.lastInvoiceDate ? new Date(budget.lastInvoiceDate) : null;
    if (lastInvoiceDate) {
      return Math.round(
        allocations
          .filter((a) => a.projectId === projectId && new Date(a.weekStartDate) > lastInvoiceDate)
          .reduce((s, a) => s + a.plannedDays, 0)
      );
    }
    return Math.round(monthAllocations.filter((a) => a.projectId === projectId).reduce((s, a) => s + a.plannedDays, 0));
  };

  // Helper: update lastInvoiceDate for a budget
  const updateBudgetLastInvoiceDate = async (budgetId: string, date: string) => {
    await fetch(`/api/budgets/${budgetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastInvoiceDate: date || null }),
    });
    fetchData();
  };

  const syncIntervals = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync-intervals-status", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSyncResult(
        `Synced — ${data.projects.total} projects (${data.projects.inactive} inactive), ${data.clients.total} clients (${data.clients.inactive} inactive)`
      );
      fetchData();
    } catch (e) {
      setSyncResult(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered budgets for project dialog based on selected client
  const budgetsForProjectDialog = projClientId ? getBudgetsForClient(projClientId) : [];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>Manage</h2>

      {/* Employees */}
      <Card className="border-[#e2e4e7] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle style={{ fontFamily: "var(--font-poppins)" }}>Employees</CardTitle>
          <Button
            size="sm"
            className="bg-[#006284] hover:bg-[#004d68] text-white"
            onClick={() => {
              setEditingEmployee(null);
              setEmpName("");
              setEmpEmail("");
              setEmpRole("");
              setEmpCountry("DE");
              setEmpCapacity("5");
              setShowEmployeeDialog(true);
            }}
          >
            + Add Employee
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#000] font-semibold">Name</TableHead>
                <TableHead className="text-[#000] font-semibold">Email</TableHead>
                <TableHead className="text-[#000] font-semibold">Role</TableHead>
                <TableHead className="text-[#000] font-semibold">Country</TableHead>
                <TableHead className="text-[#000] font-semibold">Capacity</TableHead>
                <TableHead className="text-[#000] font-semibold">Status</TableHead>
                <TableHead className="w-[100px] text-[#000] font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.role}</TableCell>
                  <TableCell>{emp.country === "RO" ? "Romania" : "Germany"}</TableCell>
                  <TableCell>{emp.weeklyCapacityDays}d/week</TableCell>
                  <TableCell>
                    <Badge
                      variant={emp.isActive ? "default" : "secondary"}
                      className={emp.isActive ? "bg-[#006284]/10 text-[#006284]" : ""}
                    >
                      {emp.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-[#006284] hover:text-[#004d68]" onClick={() => openEditEmployee(emp)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => deleteEmployee(emp.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    No employees yet. Add your first employee.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Clients, Budgets & Projects */}
      <Card className="border-[#e2e4e7] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle style={{ fontFamily: "var(--font-poppins)" }}>Clients, Budgets & Projects</CardTitle>
            {syncResult && (
              <p className={`text-xs mt-1 ${syncResult.startsWith("Sync failed") ? "text-red-500" : "text-[#006284]"}`}>
                {syncResult}
              </p>
            )}
            {!syncResult && (
              <p className="text-xs text-[#747577] mt-1">
                Synced from MyIntervals via BudgetApp.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#747577] text-[#747577] hover:bg-[#747577]/10"
              onClick={syncIntervals}
              disabled={isSyncing}
            >
              {isSyncing ? "Syncing…" : "Sync from Intervals"}
            </Button>
            <Button size="sm" variant="outline" className="border-[#006284] text-[#006284] hover:bg-[#006284]/10" onClick={() => setShowClientDialog(true)}>
              + Add Client
            </Button>
            <Button size="sm" variant="outline" className="border-[#006284] text-[#006284] hover:bg-[#006284]/10" onClick={() => setShowBudgetDialog(true)}>
              + Add Budget
            </Button>
            <Button size="sm" className="bg-[#006284] hover:bg-[#004d68] text-white" onClick={() => setShowProjectDialog(true)}>
              + Add Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No clients yet. Add your first client.
            </div>
          ) : (
            <div className="space-y-4">
              {clients.map((client) => {
                const clientBudgets = getBudgetsForClient(client.id);
                const unassignedProjects = getUnassignedProjects(client.id);

                return (
                  <div key={client.id} className="border border-[#e2e4e7] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{client.name}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => deleteClient(client.id)}
                      >
                        Delete Client
                      </Button>
                    </div>

                    {/* Budgets */}
                    {clientBudgets.map((budget) => {
                      const budgetInvoiced = getBudgetInvoicedDays(budget);
                      const budgetSinceInvoice = getBudgetSinceLastInvoice(budget);
                      const budgetPlannedMonth = getBudgetPlannedThisMonth(budget.id);
                      const budgetTotalUsed = getBudgetTotalUsed(budget);
                      const budgetRemaining = budget.budgetDays != null ? Math.round(budget.budgetDays - budgetTotalUsed) : null;
                      const budgetProjectsList = getProjectsForBudget(budget.id);

                      return (
                        <div key={budget.id} className="mb-3">
                          <div className="flex items-center justify-between bg-[#f5f6f7] rounded px-3 py-2 mb-1">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-[#006284] text-sm">{budget.name}</span>
                              {budget.lastInvoiceDate && (
                                <span className="text-[10px] text-[#747577]">
                                  Last invoice: {new Date(budget.lastInvoiceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                className="text-xs border border-[#e2e4e7] rounded px-2 py-1 text-[#747577]"
                                value={budget.lastInvoiceDate ? new Date(budget.lastInvoiceDate).toISOString().split("T")[0] : ""}
                                onChange={(e) => updateBudgetLastInvoiceDate(budget.id, e.target.value)}
                                title="Last invoice date"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 h-6 text-xs"
                                onClick={() => deleteBudget(budget.id)}
                              >
                                Delete Budget
                              </Button>
                            </div>
                          </div>
                          {budget.budgetDays != null && (
                            <div className="grid grid-cols-5 gap-2 ml-4 mb-2">
                              <div className="bg-white border border-[#e2e4e7] rounded px-3 py-2">
                                <div className="text-sm font-bold text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>{budget.budgetDays}d</div>
                                <div className="text-[10px] text-[#747577]">Total</div>
                              </div>
                              <div className="bg-white border border-[#e2e4e7] rounded px-3 py-2">
                                <div className="text-sm font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>{budgetInvoiced}d</div>
                                <div className="text-[10px] text-[#747577]">Invoiced So Far</div>
                              </div>
                              <div className="bg-white border border-[#e2e4e7] rounded px-3 py-2">
                                <div className="text-sm font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>{budgetSinceInvoice}d</div>
                                <div className="text-[10px] text-[#747577]">Since Last Invoice</div>
                              </div>
                              <div className="bg-white border border-[#e2e4e7] rounded px-3 py-2">
                                <div className="text-sm font-bold text-[#006284]" style={{ fontFamily: "var(--font-poppins)" }}>{budgetPlannedMonth}d</div>
                                <div className="text-[10px] text-[#747577]">Planned This Month</div>
                              </div>
                              <div className="bg-white border border-[#e2e4e7] rounded px-3 py-2">
                                <div className={`text-sm font-bold ${
                                  budgetRemaining != null && budgetRemaining < 0 ? "text-red-600" :
                                  budgetRemaining != null && budget.budgetDays && budgetRemaining < budget.budgetDays * 0.2 ? "text-[#faa61a]" :
                                  "text-[#006284]"
                                }`} style={{ fontFamily: "var(--font-poppins)" }}>{budgetRemaining}d</div>
                                <div className="text-[10px] text-[#747577]">Remaining</div>
                              </div>
                            </div>
                          )}
                          {budgetProjectsList.length > 0 ? (
                            <Table className="table-fixed ml-4">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-[#000] font-semibold w-[35%]">Project</TableHead>
                                  <TableHead className="text-center text-[#000] font-semibold w-[15%]">Invoiced</TableHead>
                                  <TableHead className="text-center text-[#000] font-semibold w-[15%]">Since Last Invoice</TableHead>
                                  <TableHead className="text-right text-[#000] font-semibold w-[20%]">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {budgetProjectsList.map((proj) => {
                                  const lastInvDate = budget.lastInvoiceDate ? new Date(budget.lastInvoiceDate) : null;
                                  const usedDays = getProjectInvoicedDays(proj.id, lastInvDate);
                                  const sinceInvoice = getProjectSinceLastInvoice(proj.id, budget);
                                  return (
                                    <TableRow key={proj.id}>
                                      <TableCell>{proj.name}</TableCell>
                                      <TableCell className="text-center">
                                        {usedDays > 0 ? `${usedDays}d` : "-"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {sinceInvoice > 0 ? `${sinceInvoice}d` : "-"}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-500"
                                          onClick={() => deleteProject(proj.id)}
                                        >
                                          Delete
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-xs text-gray-400 ml-4">No projects in this budget</p>
                          )}
                        </div>
                      );
                    })}

                    {/* Unassigned Projects */}
                    {unassignedProjects.length > 0 && (
                      <div className="mt-2">
                        {clientBudgets.length > 0 && (
                          <div className="text-xs font-semibold text-[#747577] mb-1 px-3">Unassigned Projects</div>
                        )}
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[#000] font-semibold w-[40%]">Project</TableHead>
                              <TableHead className="text-center text-[#000] font-semibold w-[15%]">Budget (days)</TableHead>
                              <TableHead className="text-center text-[#000] font-semibold w-[15%]">Used</TableHead>
                              <TableHead className="text-center text-[#000] font-semibold w-[15%]">Remaining</TableHead>
                              <TableHead className="text-right text-[#000] font-semibold w-[15%]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unassignedProjects.map((proj) => {
                              const usedDays = Math.round(allocations.filter((a) => a.projectId === proj.id).reduce((s, a) => s + a.plannedDays, 0));
                              const remaining = proj.budgetDays != null ? Math.round(proj.budgetDays - usedDays) : null;
                              return (
                                <TableRow key={proj.id}>
                                  <TableCell>{proj.name}</TableCell>
                                  <TableCell className="text-center">
                                    {proj.budgetDays != null ? `${proj.budgetDays}d` : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {usedDays > 0 ? `${usedDays}d` : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {remaining != null ? (
                                      <span className={remaining < 0 ? "text-red-600 font-semibold" : remaining === 0 ? "text-[#faa61a] font-semibold" : "text-[#006284] font-semibold"}>
                                        {remaining}d
                                      </span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500"
                                      onClick={() => deleteProject(proj.id)}
                                    >
                                      Delete
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {clientBudgets.length === 0 && unassignedProjects.length === 0 && (
                      <p className="text-sm text-gray-400">No budgets or projects yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name</Label>
              <Input value={empName} onChange={(e) => setEmpName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Input
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value)}
                placeholder="e.g., Senior Developer"
              />
            </div>
            <div>
              <Label>Country</Label>
              <Select value={empCountry} onValueChange={(v) => v && setEmpCountry(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DE">Germany (DE)</SelectItem>
                  <SelectItem value="RO">Romania (RO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Weekly Capacity (days)</Label>
              <Input
                type="number"
                min={0}
                max={7}
                step={0.5}
                value={empCapacity}
                onChange={(e) => setEmpCapacity(e.target.value)}
                placeholder="5"
              />
              <p className="text-[10px] text-[#747577] mt-1">Standard is 5 days/week. Use less for part-time.</p>
            </div>
            <Button onClick={saveEmployee} className="w-full bg-[#006284] hover:bg-[#004d68] text-white">
              {editingEmployee ? "Update" : "Add"} Employee
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Dialog */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <Button onClick={saveClient} className="w-full bg-[#006284] hover:bg-[#004d68] text-white">
              Add Client
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Client</Label>
              <Select value={budgetClientId} onValueChange={(v) => v && setBudgetClientId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget Name</Label>
              <Input
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="e.g., Q1 2026 Retainer"
              />
            </div>
            <div>
              <Label>Budget Days (optional)</Label>
              <Input
                type="number"
                min={0}
                value={budgetDays}
                onChange={(e) => setBudgetDays(e.target.value)}
                placeholder="e.g., 120"
              />
            </div>
            <Button onClick={saveBudget} className="w-full bg-[#006284] hover:bg-[#004d68] text-white">
              Add Budget
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Client</Label>
              <Select value={projClientId} onValueChange={(v) => { if (v) { setProjClientId(v); setProjBudgetId(""); } }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project Name</Label>
              <Input
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
              />
            </div>
            {budgetsForProjectDialog.length > 0 && (
              <div>
                <Label>Budget (optional)</Label>
                <Select value={projBudgetId} onValueChange={(v) => v && setProjBudgetId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No budget (unassigned)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No budget (unassigned)</SelectItem>
                    {budgetsForProjectDialog.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Budget (days, optional)</Label>
              <Input
                type="number"
                min={0}
                value={projBudgetDays}
                onChange={(e) => setProjBudgetDays(e.target.value)}
                placeholder="e.g., 60"
              />
              <p className="text-[10px] text-[#747577] mt-1">Project-level budget days. If using a budget entity, this is usually left empty.</p>
            </div>
            <Button onClick={saveProject} className="w-full bg-[#006284] hover:bg-[#004d68] text-white">
              Add Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
