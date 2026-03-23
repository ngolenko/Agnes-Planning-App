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
import { Employee, Client, Project, Allocation } from "@/lib/types";

export default function ManagePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<(Client & { projects: Project[] })[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form state
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empCapacity, setEmpCapacity] = useState("5");
  const [clientName, setClientName] = useState("");
  const [projName, setProjName] = useState("");
  const [projClientId, setProjClientId] = useState("");
  const [projDayRate, setProjDayRate] = useState("");
  const [projBudgetDays, setProjBudgetDays] = useState("");

  const fetchData = useCallback(async () => {
    const [empRes, clientRes, allocRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/clients"),
      fetch("/api/projects"),
    ]);
    setEmployees(await empRes.json());
    setClients(await clientRes.json());
    // Fetch all allocations for budget remaining calculation
    const planRes = await fetch(`/api/planning?year=${new Date().getFullYear()}&month=${new Date().getMonth()}`);
    const planData = await planRes.json();
    setAllocations(planData.allAllocations || []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveEmployee = async () => {
    const body = { name: empName, email: empEmail, role: empRole, weeklyCapacityDays: parseFloat(empCapacity) || 5 };
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

  const saveProject = async () => {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projName,
        clientId: projClientId,
        dayRate: projDayRate ? parseFloat(projDayRate) : null,
        budgetDays: projBudgetDays ? parseFloat(projBudgetDays) : null,
      }),
    });
    setShowProjectDialog(false);
    setProjName("");
    setProjClientId("");
    setProjDayRate("");
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
    setEmpCapacity(emp.weeklyCapacityDays.toString());
    setShowEmployeeDialog(true);
  };

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
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No employees yet. Add your first employee.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Clients & Projects */}
      <Card className="border-[#e2e4e7] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle style={{ fontFamily: "var(--font-poppins)" }}>Clients & Projects</CardTitle>
            <p className="text-xs text-[#747577] mt-1">
              Will sync from Fabric once connected. Manual entries below for now.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-[#006284] text-[#006284] hover:bg-[#006284]/10" onClick={() => setShowClientDialog(true)}>
              + Add Client
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
              {clients.map((client) => (
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
                  {client.projects && client.projects.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[#000] font-semibold">Project</TableHead>
                          <TableHead className="text-center text-[#000] font-semibold">Budget (days)</TableHead>
                          <TableHead className="text-center text-[#000] font-semibold">Used</TableHead>
                          <TableHead className="text-center text-[#000] font-semibold">Remaining</TableHead>
                          <TableHead className="w-[80px] text-[#000] font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {client.projects.map((proj) => {
                          const usedDays = Math.round(
                            allocations
                              .filter((a) => a.projectId === proj.id)
                              .reduce((s, a) => s + a.plannedDays, 0)
                          );
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
                              <TableCell>
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
                    <p className="text-sm text-gray-400">No projects yet</p>
                  )}
                </div>
              ))}
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

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Client</Label>
              <Select value={projClientId} onValueChange={setProjClientId}>
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
            <div>
              <Label>Day Rate (EUR, optional)</Label>
              <Input
                type="number"
                value={projDayRate}
                onChange={(e) => setProjDayRate(e.target.value)}
                placeholder="e.g., 1200"
              />
            </div>
            <div>
              <Label>Budget (days, optional)</Label>
              <Input
                type="number"
                min={0}
                value={projBudgetDays}
                onChange={(e) => setProjBudgetDays(e.target.value)}
                placeholder="e.g., 60"
              />
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
