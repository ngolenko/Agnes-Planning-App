import { prisma } from "@/lib/db";
import { getInvoicedHours, HOURS_PER_DAY } from "@/lib/invoices";
import { NextRequest, NextResponse } from "next/server";

function normalizeAllocation(a: {
  id: string;
  employeeId: string;
  projectId: number;
  weekStartDate: Date;
  plannedDays: number;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    id: number;
    projectName: string | null;
    customerId: number | null;
    customer?: { id: number; customerName: string | null } | null;
  } | null;
  employee?: object | null;
}) {
  return {
    ...a,
    projectId: String(a.projectId),
    project: a.project
      ? {
          id: String(a.project.id),
          name: a.project.projectName ?? "",
          clientId: String(a.project.customerId ?? ""),
          client: a.project.customer
            ? { id: String(a.project.customer.id), name: a.project.customer.customerName ?? "" }
            : null,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    return await planningGET(request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}

async function planningGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());

  // Date range for filtering
  let rangeStart: Date;
  let rangeEnd: Date;
  let prevRangeStart: Date;
  let prevRangeEnd: Date;
  let period: { year: number; month: number; weekStart?: string };

  if (weekStart) {
    // Weekly mode: single week
    rangeStart = new Date(weekStart + "T00:00:00.000Z");
    rangeEnd = new Date(weekStart + "T00:00:00.000Z");
    // Previous week
    const prevWeek = new Date(rangeStart);
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
    prevRangeStart = prevWeek;
    prevRangeEnd = prevWeek;
    period = { year: rangeStart.getUTCFullYear(), month: rangeStart.getUTCMonth(), weekStart };
  } else {
    // Monthly mode
    rangeStart = new Date(Date.UTC(year, month, 1));
    rangeEnd = new Date(Date.UTC(year, month + 1, 0));
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    prevRangeStart = new Date(Date.UTC(prevYear, prevMonth, 1));
    prevRangeEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0));
    period = { year, month };
  }

  const [employees, allocations, prevAllocations, timeOff, unbillable, allAllocations, budgets, projects, customers] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.allocation.findMany({
      where: { weekStartDate: { gte: rangeStart, lte: rangeEnd } },
      include: { project: { include: { customer: true } }, employee: true },
    }),
    prisma.allocation.findMany({
      where: { weekStartDate: { gte: prevRangeStart, lte: prevRangeEnd } },
      include: { project: { include: { customer: true } }, employee: true },
    }),
    prisma.timeOff.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.unbillableTime.findMany({
      where: { weekStartDate: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.allocation.findMany({
      include: { project: { include: { customer: true } }, employee: true },
    }),
    prisma.budgetRecord.findMany({
      where: {
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      include: {
        customer: true,
        mappings: {
          where: { project: { isActive: true } },
          include: { project: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.budgetProject.findMany({
      where: { isActive: true },
      include: { customer: true },
      orderBy: { projectName: "asc" },
    }),
    prisma.budgetCustomer.findMany({
      where: { isActive: true },
      include: { projects: { where: { isActive: true } } },
      orderBy: { customerName: "asc" },
    }),
  ]);

  const normalizeProject = (p: { id: number; projectName: string | null; customerId: number | null; customer?: { id: number; customerName: string | null } | null }) => ({
    id: String(p.id),
    name: p.projectName ?? "",
    clientId: String(p.customerId ?? ""),
    fabricProjectId: String(p.id),
    budgetDays: null,
    isActive: true,
    client: p.customer ? { id: String(p.customer.id), name: p.customer.customerName ?? "" } : null,
  });

  // Real invoiced hours (budget.Invoice) for these budgets — same source as /api/budgets.
  const { byBudget: invoicedHByBudget, byBudgetProject: invoicedHByBudgetProject } =
    await getInvoicedHours(budgets.map((b) => b.id));

  const normalizeBudget = (b: {
    id: number;
    name: string;
    customerId: number;
    endDate?: Date | null;
    budgetH?: { toNumber: () => number } | null;
    customer?: { id: number; customerName: string | null } | null;
    mappings?: { project: { id: number; projectName: string | null; customerId: number | null; lastInvoiceDate?: Date | null } }[];
  }) => {
    const projectDates = (b.mappings ?? [])
      .map((m) => m.project.lastInvoiceDate)
      .filter((d): d is Date => d != null);
    const lastInvoiceDate = projectDates.length > 0
      ? new Date(Math.max(...projectDates.map((d) => d.getTime()))).toISOString()
      : null;

    const invoicedSoFar = (invoicedHByBudget.get(b.id) ?? 0) / HOURS_PER_DAY;
    const projectInvoiced: Record<string, number> = {};
    for (const m of b.mappings ?? []) {
      const h = invoicedHByBudgetProject.get(`${b.id}:${m.project.id}`) ?? 0;
      if (h) projectInvoiced[String(m.project.id)] = h / HOURS_PER_DAY;
    }

    return {
      id: String(b.id),
      name: b.name,
      clientId: String(b.customerId),
      budgetDays: b.budgetH != null ? Number(b.budgetH) / HOURS_PER_DAY : null,
      fabricBudgetId: String(b.id),
      isActive: b.endDate ? b.endDate >= new Date() : true,
      lastInvoiceDate,
      invoicedSoFar,
      projectInvoiced,
      client: b.customer ? { id: String(b.customer.id), name: b.customer.customerName ?? "" } : null,
      projects: (b.mappings ?? []).map((m) => normalizeProject(m.project)),
    };
  };

  const normalizeCustomer = (c: { id: number; customerName: string | null; projects?: { id: number; projectName: string | null; customerId: number | null }[] }) => ({
    id: String(c.id),
    name: c.customerName ?? "",
    projects: (c.projects ?? []).map(normalizeProject),
  });

  return NextResponse.json({
    employees,
    allocations: allocations.map(normalizeAllocation),
    prevAllocations: prevAllocations.map(normalizeAllocation),
    timeOff,
    unbillable,
    allAllocations: allAllocations.map(normalizeAllocation),
    projects: projects.map(normalizeProject),
    clients: customers.map(normalizeCustomer),
    budgets: budgets.map(normalizeBudget),
    period,
  });
}
