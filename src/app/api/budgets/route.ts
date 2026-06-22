import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function normalizeBudget(b: {
  id: number;
  customerId: number;
  name: string;
  endDate?: Date | null;
  budgetH?: { toNumber: () => number } | null;
  customer?: { id: number; customerName: string | null } | null;
  mappings?: { project: { id: number; projectName: string | null; customerId: number | null; lastInvoiceDate?: Date | null } }[];
}) {
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
  return {
    id: String(b.id),
    name: b.name,
    clientId: String(b.customerId),
    budgetDays: b.budgetH != null ? Number(b.budgetH) / 8 : null,
    fabricBudgetId: String(b.id),
    isActive: b.endDate ? b.endDate >= new Date() : true,
    lastInvoiceDate,
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
  return NextResponse.json(budgets.map(normalizeBudget));
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
