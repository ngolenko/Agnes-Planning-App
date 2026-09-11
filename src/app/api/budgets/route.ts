import { prisma } from "@/lib/db";
import { getInvoicedHours, HOURS_PER_DAY } from "@/lib/invoices";
import { NextRequest, NextResponse } from "next/server";

function normalizeBudget(
  b: {
    id: number;
    customerId: number;
    name: string;
    endDate?: Date | null;
    budgetH?: { toNumber: () => number } | null;
    customer?: { id: number; customerName: string | null } | null;
    mappings?: { project: { id: number; projectName: string | null; customerId: number | null; lastInvoiceDate?: Date | null } }[];
  },
  invoicedHByBudget: Map<number, number>,
  invoicedHByBudgetProject: Map<string, number>,
) {
  const projects = (b.mappings ?? []).map((m) => ({
    id: String(m.project.id),
    name: m.project.projectName ?? "",
    clientId: String(m.project.customerId ?? ""),
  }));
  const projectDates = (b.mappings ?? [])
    .map((m) => m.project.lastInvoiceDate)
    .filter((d): d is Date => d != null);
  const lastInvoiceDate = projectDates.length > 0
    ? new Date(Math.max(...projectDates.map((d) => d.getTime()))).toISOString()
    : null;

  // Actual invoiced amounts come from budget.Invoice (real billing data), not from
  // Agnes planning allocations. Keyed by BudgetId, with a per-project breakdown by ProjectId.
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
    projects,
  };
}

export async function GET() {
  const budgets = await prisma.budgetRecord.findMany({
    include: {
      customer: true,
      mappings: {
        where: { project: { isActive: true } },
        include: { project: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Pull real invoiced hours for these budgets and aggregate per budget and per project.
  const { byBudget, byBudgetProject } = await getInvoicedHours(budgets.map((b) => b.id));

  return NextResponse.json(budgets.map((b) => normalizeBudget(b, byBudget, byBudgetProject)));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const budgetAppUrl = process.env.BUDGET_APP_URL;
  const apiKey = process.env.BUDGET_APP_API_KEY;

  if (!budgetAppUrl) {
    return NextResponse.json({ error: "BUDGET_APP_URL not configured" }, { status: 500 });
  }

  const res = await fetch(`${budgetAppUrl}/add-budget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { XApiKey: apiKey } : {}),
    },
    body: JSON.stringify({
      name: body.name,
      customerId: parseInt(body.clientId),
      budgetH: body.budgetDays != null ? body.budgetDays * 8 : null,
      externalName: body.externalName || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `BudgetApp error: ${text}` }, { status: res.status });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
