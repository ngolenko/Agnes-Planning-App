"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Allocation, Employee, Project, Client } from "@/lib/types";

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  weekStart: Date | null;
  projects: (Project & { client: Client })[];
  existingAllocations: Allocation[];
  onSaved: () => void;
}

interface AllocationRow {
  id?: string;
  projectId: string;
  plannedDays: number;
}

export function AllocationDialog({
  open,
  onOpenChange,
  employee,
  weekStart,
  projects,
  existingAllocations,
  onSaved,
}: AllocationDialogProps) {
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && existingAllocations.length > 0) {
      setRows(
        existingAllocations.map((a) => ({
          id: a.id,
          projectId: a.projectId,
          plannedDays: a.plannedDays,
        }))
      );
    } else if (open) {
      setRows([{ projectId: "", plannedDays: 0 }]);
    }
  }, [open, existingAllocations]);

  const addRow = () => setRows([...rows, { projectId: "", plannedDays: 0 }]);

  const removeRow = async (index: number) => {
    const row = rows[index];
    if (row.id) {
      await fetch(`/api/allocations/${row.id}`, { method: "DELETE" });
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof AllocationRow, value: string | number) => {
    const updated = [...rows];
    if (field === "plannedDays") {
      updated[index] = { ...updated[index], [field]: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setRows(updated);
  };

  const save = async () => {
    if (!employee || !weekStart) return;
    setSaving(true);

    // Delete allocations that were removed
    const existingIds = new Set(existingAllocations.map((a) => a.id));
    const currentIds = new Set(rows.filter((r) => r.id).map((r) => r.id));
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        await fetch(`/api/allocations/${id}`, { method: "DELETE" });
      }
    }

    // Save/update remaining
    for (const row of rows) {
      if (!row.projectId || row.plannedDays <= 0) continue;
      await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          projectId: row.projectId,
          weekStartDate: weekStart.toISOString(),
          plannedDays: row.plannedDays,
        }),
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  // Group projects by client
  const projectsByClient = new Map<string, { client: Client; projects: Project[] }>();
  for (const p of projects) {
    if (!projectsByClient.has(p.clientId)) {
      projectsByClient.set(p.clientId, { client: p.client, projects: [] });
    }
    projectsByClient.get(p.clientId)!.projects.push(p);
  }

  const totalDays = rows.reduce((s, r) => s + (r.plannedDays || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {employee?.name} &mdash; Week of{" "}
            {weekStart?.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {rows.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Project</Label>
                <Select
                  value={row.projectId}
                  onValueChange={(v) => updateRow(index, "projectId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(projectsByClient).map(([clientId, { client, projects: clientProjects }]) => (
                      <div key={clientId}>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                          {client.name}
                        </div>
                        {clientProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20">
                <Label className="text-xs">Days</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={row.plannedDays || ""}
                  onChange={(e) => updateRow(index, "plannedDays", e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 mb-0.5"
                onClick={() => removeRow(index)}
              >
                &times;
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow} className="w-full">
            + Add Project
          </Button>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="text-sm">
              Total: <span className="font-semibold">{totalDays}d</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
