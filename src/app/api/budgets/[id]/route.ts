import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const budget = await prisma.budgetRecord.findUnique({
    where: { id: numId },
    include: {
      customer: true,
      mappings: { include: { project: true } },
    },
  });
  if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projects = budget.mappings.map((m) => ({
    id: String(m.project.id),
    name: m.project.projectName ?? "",
    clientId: String(m.project.customerId ?? ""),
  }));

  return NextResponse.json({
    id: String(budget.id),
    name: budget.name,
    clientId: String(budget.customerId),
    budgetDays: budget.budgetH != null ? Number(budget.budgetH) / 8 : null,
    fabricBudgetId: String(budget.id),
    isActive: budget.endDate ? budget.endDate >= new Date() : true,
    client: budget.customer ? { id: String(budget.customer.id), name: budget.customer.customerName ?? "" } : null,
    projects,
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const budgetAppUrl = process.env.BUDGET_APP_URL;
  const apiKey = process.env.BUDGET_APP_API_KEY;

  if (!budgetAppUrl) {
    return NextResponse.json({ error: "BUDGET_APP_URL not configured" }, { status: 500 });
  }

  const res = await fetch(`${budgetAppUrl}/edit-budget`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { XApiKey: apiKey } : {}),
    },
    body: JSON.stringify({
      id: parseInt(id),
      name: body.name,
      customerId: body.clientId ? parseInt(body.clientId) : undefined,
      budgetH: body.budgetDays != null ? body.budgetDays * 8 : undefined,
      externalName: body.externalName,
      startDate: body.startDate,
      endDate: body.endDate,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `BudgetApp error: ${text}` }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const budgetAppUrl = process.env.BUDGET_APP_URL;
  const apiKey = process.env.BUDGET_APP_API_KEY;

  if (!budgetAppUrl) {
    return NextResponse.json({ error: "BUDGET_APP_URL not configured" }, { status: 500 });
  }

  const res = await fetch(`${budgetAppUrl}/delete-budget/${numId}`, {
    method: "DELETE",
    headers: apiKey ? { XApiKey: apiKey } : {},
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `BudgetApp error: ${text}` }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}
