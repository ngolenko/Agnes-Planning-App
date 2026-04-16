"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Employee, TimeOff, UnbillableTime } from "@/lib/types";
import { formatMonthYear, getWorkingDaysInMonth, getEmployeeWorkingDaysInMonth } from "@/lib/dates";

interface EmployeeSummary {
  employee: Employee;
  vacation: number;
  sick: number;
  unbillable: number;
  totalOff: number;
}

export default function TimeOffPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [unbillable, setUnbillable] = useState<UnbillableTime[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  // Detail form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeTimeOff, setEmployeeTimeOff] = useState<TimeOff[]>([]);
  const [addType, setAddType] = useState<string>("vacation");
  const [addStartDate, setAddStartDate] = useState("");
  const [addEndDate, setAddEndDate] = useState("");
  const [unbillableDays, setUnbillableDays] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const startDate = new Date(Date.UTC(year, month, 1)).toISOString();
  const endDate = new Date(Date.UTC(year, month + 1, 0)).toISOString();

  const fetchData = useCallback(async () => {
    const [empRes, toRes, ubRes] = await Promise.all([
      fetch("/api/employees", { cache: "no-store" }),
      fetch(`/api/time-off?startDate=${startDate}&endDate=${endDate}`, { cache: "no-store" }),
      fetch(`/api/unbillable?startDate=${startDate}&endDate=${endDate}`, { cache: "no-store" }),
    ]);
    setEmployees(await empRes.json());
    setTimeOff(await toRes.json());
    setUnbillable(await ubRes.json());
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When employee is selected, load their detail data
  const fetchEmployeeDetail = useCallback(async () => {
    if (!selectedEmployeeId) return;
    const res = await fetch(
      `/api/time-off?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}`,
      { cache: "no-store" }
    );
    setEmployeeTimeOff(await res.json());

    // Load unbillable total for this employee this month
    const ubRes = await fetch(
      `/api/unbillable?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}`,
      { cache: "no-store" }
    );
    const ubData: UnbillableTime[] = await ubRes.json();
    setUnbillableDays(ubData.reduce((s, u) => s + u.plannedDays, 0));
  }, [selectedEmployeeId, startDate, endDate]);

  useEffect(() => {
    fetchEmployeeDetail();
  }, [fetchEmployeeDetail]);

  // Build summary table data
  const summaries: EmployeeSummary[] = employees.map((emp) => {
    const empTimeOff = timeOff.filter((t) => t.employeeId === emp.id);
    const empUnbillable = unbillable
      .filter((u) => u.employeeId === emp.id)
      .reduce((s, u) => s + u.plannedDays, 0);

    const vacation = empTimeOff.filter((t) => t.type === "vacation").length;
    const sick = empTimeOff.filter((t) => t.type === "sick").length;

    return {
      employee: emp,
      vacation,
      sick,
      unbillable: empUnbillable,
      totalOff: vacation + sick + empUnbillable,
    };
  });

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handleAddTimeOff = async () => {
    if (!selectedEmployeeId || !addStartDate || !addEndDate) return;
    setSaving(true);
    await fetch("/api/time-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: selectedEmployeeId,
        startDate: addStartDate,
        endDate: addEndDate,
        type: addType,
      }),
    });
    setAddStartDate("");
    setAddEndDate("");
    await Promise.all([fetchEmployeeDetail(), fetchData()]);
    setSaving(false);
  };

  const handleDeleteTimeOff = async (id: string) => {
    await fetch(`/api/time-off/${id}`, { method: "DELETE" });
    await Promise.all([fetchEmployeeDetail(), fetchData()]);
  };

  const handleSaveUnbillable = async () => {
    if (!selectedEmployeeId) return;
    // Use first Monday ON OR AFTER the 1st so weekStartDate falls within the month
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const weekStart = new Date(firstOfMonth);
    const dow = weekStart.getUTCDay();
    if (dow !== 1) {
      weekStart.setUTCDate(weekStart.getUTCDate() + (dow === 0 ? 1 : 8 - dow));
    }

    await fetch("/api/unbillable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: selectedEmployeeId,
        weekStartDate: weekStart.toISOString(),
        category: "internal",
        plannedDays: unbillableDays,
      }),
    });
    await Promise.all([fetchEmployeeDetail(), fetchData()]);
  };

  const selectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    setAddStartDate("");
    setAddEndDate("");
  };

  const workingDays = getWorkingDaysInMonth(year, month);

  const typeColors: Record<string, string> = {
    vacation: "bg-[#006284]/10 text-[#006284]",
    sick: "bg-red-100 text-red-700",
  };
  const typeLabels: Record<string, string> = {
    vacation: "Vacation",
    sick: "Sick",
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-poppins)" }}>Time Off</h2>
          <p className="text-sm text-[#747577] mt-1">
            {workingDays} working days in {formatMonthYear(year, month)}
          </p>
        </div>
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
          <span className="font-semibold min-w-[160px] text-center text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
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

      {/* Overview Table */}
      <Card className="border-[#e2e4e7] shadow-sm overflow-hidden">
        <CardHeader className="bg-[#006284] text-white py-3 px-5">
          <CardTitle className="text-base text-white" style={{ fontFamily: "var(--font-poppins)" }}>
            Overview &mdash; {formatMonthYear(year, month)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b-[#e2e4e7] bg-[#f5f6f7]">
                <TableHead className="font-semibold text-[#000]">Name</TableHead>
                <TableHead className="text-center font-semibold text-[#000]">Vacation</TableHead>
                <TableHead className="text-center font-semibold text-[#000]">Sick</TableHead>
                <TableHead className="text-center font-semibold text-[#000]">Unbillable</TableHead>
                <TableHead className="text-center font-semibold text-[#000]">Total Off</TableHead>
                <TableHead className="text-center font-semibold text-[#000]">Available</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s, idx) => {
                const empWorkingDays = getEmployeeWorkingDaysInMonth(s.employee.weeklyCapacityDays, year, month, s.employee.country as "DE" | "RO" | undefined);
                const availableDays = empWorkingDays - s.totalOff;
                const isSelected = s.employee.id === selectedEmployeeId;
                return (
                  <TableRow
                    key={s.employee.id}
                    className={`border-b-[#e2e4e7] cursor-pointer transition-colors ${
                      isSelected ? "bg-[#e8f7fa]" : idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"
                    } hover:bg-[#e8f7fa]/60`}
                    onClick={() => selectEmployee(s.employee.id)}
                  >
                    <TableCell>
                      <div className="font-semibold text-[#000]">{s.employee.name}</div>
                      <div className="text-xs text-[#747577]">{s.employee.role}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.vacation > 0 ? (
                        <Badge className="bg-[#006284]/10 text-[#006284] border-0">{s.vacation}d</Badge>
                      ) : (
                        <span className="text-[#e2e4e7]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.sick > 0 ? (
                        <Badge className="bg-red-100 text-red-700 border-0">{s.sick}d</Badge>
                      ) : (
                        <span className="text-[#e2e4e7]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.unbillable > 0 ? (
                        <Badge className="bg-[#87d3df]/20 text-[#006284] border-0">{Number(s.unbillable.toFixed(1))}d</Badge>
                      ) : (
                        <span className="text-[#e2e4e7]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-[#000]">
                      {s.totalOff > 0 ? `${Number(s.totalOff.toFixed(1))}d` : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${availableDays < empWorkingDays * 0.5 ? "text-[#faa61a]" : "text-[#006284]"}`}>
                        {Number(availableDays.toFixed(1))}d / {empWorkingDays}d
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#006284] hover:bg-[#e8f7fa]"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectEmployee(s.employee.id);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#747577]">
                    No employees yet. Add employees in the Manage section.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Form */}
      {selectedEmployeeId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Time Off */}
          <Card className="border-[#e2e4e7] shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
                Add Time Off
              </CardTitle>
              <p className="text-sm text-[#747577]">
                for {employees.find((e) => e.id === selectedEmployeeId)?.name}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-[#000]">Type</Label>
                <Select value={addType} onValueChange={(v) => v && setAddType(v)}>
                  <SelectTrigger className="border-[#e2e4e7] focus:ring-[#87d3df] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-[#000]">From</Label>
                  <Input
                    type="date"
                    value={addStartDate}
                    onChange={(e) => setAddStartDate(e.target.value)}
                    className="border-[#e2e4e7] focus:ring-[#87d3df] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#000]">To</Label>
                  <Input
                    type="date"
                    value={addEndDate}
                    onChange={(e) => setAddEndDate(e.target.value)}
                    className="border-[#e2e4e7] focus:ring-[#87d3df] mt-1"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddTimeOff}
                disabled={saving || !addStartDate || !addEndDate}
                className="w-full bg-[#006284] hover:bg-[#004d68] text-white"
              >
                {saving ? "Adding..." : "Add Time Off"}
              </Button>

              {/* Unbillable */}
              <div className="border-t border-[#e2e4e7] pt-4 mt-4">
                <Label className="text-xs font-semibold text-[#000]">Unbillable Days (this month)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min={0}
                    max={workingDays}
                    step={0.5}
                    value={unbillableDays || ""}
                    onChange={(e) => setUnbillableDays(parseFloat(e.target.value) || 0)}
                    className="border-[#e2e4e7] focus:ring-[#87d3df] w-20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveUnbillable}
                    className="border-[#006284] text-[#006284] hover:bg-[#e8f7fa]"
                  >
                    Save
                  </Button>
                </div>
                <p className="text-[10px] text-[#747577] mt-1">Internal, training, bench, admin combined</p>
              </div>
            </CardContent>
          </Card>

          {/* Existing Entries */}
          <Card className="border-[#e2e4e7] shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-[#000]" style={{ fontFamily: "var(--font-poppins)" }}>
                Entries for {employees.find((e) => e.id === selectedEmployeeId)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeeTimeOff.length === 0 ? (
                <div className="text-center py-8 text-[#747577]">
                  <p>No time off entries for this month.</p>
                  <p className="text-xs mt-1">Use the form to add vacation or sick days.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-[#e2e4e7]">
                      <TableHead className="font-semibold text-[#000]">Date</TableHead>
                      <TableHead className="font-semibold text-[#000]">Type</TableHead>
                      <TableHead className="font-semibold text-[#000]">Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeTimeOff.map((entry) => (
                      <TableRow key={entry.id} className="border-b-[#e2e4e7]">
                        <TableCell className="text-[#000]">{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <Badge className={`${typeColors[entry.type]} border-0`}>
                            {typeLabels[entry.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs ${entry.status === "confirmed" ? "text-[#006284]" : "text-[#747577]"}`}>
                            {entry.status === "confirmed" ? "Confirmed" : "Planned"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteTimeOff(entry.id)}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
