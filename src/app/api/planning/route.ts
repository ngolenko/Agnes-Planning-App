// @ts-nocheck
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());

  // Fetch everything and filter client-side for reliability with SQLite date handling
  const [employees, allAllocations, allTimeOff, allUnbillable, projects, clients, budgets] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.allocation.findMany({
      include: { project: { include: { client: true } }, employee: true },
    }),
    prisma.timeOff.findMany({}),
    prisma.unbillableTime.findMany({}),
    prisma.project.findMany({
      where: { isActive: true },
      include: { client: true, budget: true },
    }),
    prisma.client.findMany({
      include: { projects: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { isActive: true },
      include: { client: true, projects: { where: { isActive: true } } },
    }),
  ]);

  // Current month boundaries (ISO string prefix for comparison)
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

  // Filter allocations by month using string prefix matching
  const allocations = allAllocations.filter((a) => {
    const ws = typeof a.weekStartDate === "string" ? a.weekStartDate : (a.weekStartDate as Date).toISOString();
    return ws.startsWith(monthStr);
  });

  const prevAllocations = allAllocations.filter((a) => {
    const ws = typeof a.weekStartDate === "string" ? a.weekStartDate : (a.weekStartDate as Date).toISOString();
    return ws.startsWith(prevMonthStr);
  });

  const timeOff = allTimeOff.filter((t) => {
    const d = typeof t.date === "string" ? t.date : (t.date as Date).toISOString();
    return d.startsWith(monthStr);
  });

  const unbillable = allUnbillable.filter((u) => {
    const ws = typeof u.weekStartDate === "string" ? u.weekStartDate : (u.weekStartDate as Date).toISOString();
    return ws.startsWith(monthStr);
  });

  return NextResponse.json({
    employees,
    allocations,
    prevAllocations,
    timeOff,
    unbillable,
    allAllocations,
    projects,
    clients,
    budgets,
    period: { year, month },
  });
}
