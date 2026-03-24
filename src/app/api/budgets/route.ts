import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const budgets = await prisma.budget.findMany({
    include: { client: true, projects: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(budgets);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const budget = await prisma.budget.create({
    data: {
      name: body.name,
      clientId: body.clientId,
      budgetDays: body.budgetDays || null,
      fabricBudgetId: body.fabricBudgetId || null,
    },
  });
  return NextResponse.json(budget, { status: 201 });
}
