"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Employee, UnbillableTime } from "@/lib/types";
import { getWeeksInMonth, formatMonthYear } from "@/lib/dates";

const CATEGORIES = [
  { value: "internal", label: "Internal" },
  { value: "training", label: "Training" },
  { value: "bench", label: "Bench" },
  { value: "admin", label: "Admin" },
];

export default function UnbillablePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [unbillable, setUnbillable] = useState<UnbillableTime[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const fetchEmployees = useCallback(async () => {
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data);
    if (data.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(data[0].id);
    }
  }, [selectedEmployeeId]);

  const fetchUnbillable = useCallback(async () => {
    if (!selectedEmployeeId) return;
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0).toISOString();
    const res = await fetch(
      `/api/unbillable?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}`
    );
    setUnbillable(await res.json());
  }, [selectedEmployeeId, year, month]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchUnbillable(); }, [fetchUnbillable]);

  const weeks = getWeeksInMonth(year, month);

  const toLocalDateStr = (d: Date | string): string => {
    const date = typeof d === "string" ? new Date(d) : d;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const getValue = (weekStart: Date, category: string): number => {
    const weekStr = toLocalDateStr(weekStart);
    const entry = unbillable.find(
      (u) => toLocalDateStr(u.weekStartDate) === weekStr && u.category === category
    );
    return entry?.plannedDays || 0;
  };

  const setValue = async (weekStart: Date, category: string, days: number) => {
    if (days <= 0) {
      const weekStr = toLocalDateStr(weekStart);
      const entry = unbillable.find(
        (u) => toLocalDateStr(u.weekStartDate) === weekStr && u.category === category
      );
      if (entry) {
        await fetch(`/api/unbillable/${entry.id}`, { method: "DELETE" });
      }
    } else {
      await fetch("/api/unbillable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          weekStartDate: weekStart.toISOString(),
          category,
          plannedDays: days,
        }),
      });
    }
    fetchUnbillable();
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const totalByCategory = (category: string) =>
    unbillable.filter((u) => u.category === category).reduce((s, u) => s + u.plannedDays, 0);

  const grandTotal = unbillable.reduce((s, u) => s + u.plannedDays, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>Unbillable Time</h2>
        <div className="flex items-center gap-4">
          <Select value={selectedEmployeeId} onValueChange={(v) => v && setSelectedEmployeeId(v)}>
            <SelectTrigger className="w-[200px] border-[#e2e4e7] focus:ring-[#87d3df]">
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevMonth}
              className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284] hover:border-[#87d3df]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <span className="font-semibold min-w-[140px] text-center text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
              {formatMonthYear(year, month)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              className="border-[#e2e4e7] hover:bg-[#e8f7fa] hover:text-[#006284] hover:border-[#87d3df]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {selectedEmployeeId && (
        <Card className="border-[#e2e4e7] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
              Unbillable hours by week and category
            </CardTitle>
            {grandTotal > 0 && (
              <p className="text-sm text-[#747577]">
                Total this month: <span className="font-semibold text-[#006284]">{grandTotal}d</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b-[#e2e4e7]">
                  <TableHead className="font-semibold text-[#000]">Category</TableHead>
                  {weeks.map((week) => (
                    <TableHead key={week.toISOString()} className="text-center font-semibold text-[#000]">
                      {week.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </TableHead>
                  ))}
                  <TableHead className="text-center bg-[#f5f6f7] font-semibold text-[#000]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CATEGORIES.map((cat) => (
                  <TableRow key={cat.value} className="border-b-[#e2e4e7]">
                    <TableCell className="font-medium text-[#000]">{cat.label}</TableCell>
                    {weeks.map((week) => (
                      <TableCell key={week.toISOString()} className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          className="w-16 mx-auto text-center border-[#e2e4e7] focus:ring-[#87d3df] focus:border-[#87d3df]"
                          value={getValue(week, cat.value) || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setValue(week, cat.value, val);
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold text-[#006284] bg-[#f5f6f7]">
                      {totalByCategory(cat.value)}d
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
