import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function normalizeCustomer(c: { id: number; customerName: string | null; projects?: { id: number; projectName: string | null; customerId: number | null }[] }) {
  return {
    id: String(c.id),
    name: c.customerName ?? "",
    projects: (c.projects ?? []).map((p) => ({
      id: String(p.id),
      name: p.projectName ?? "",
      clientId: String(p.customerId ?? ""),
    })),
  };
}

export async function GET() {
  const customers = await prisma.budgetCustomer.findMany({
    where: { isActive: true },
    include: { projects: { where: { isActive: true } } },
    orderBy: { customerName: "asc" },
  });
  return NextResponse.json(customers.map(normalizeCustomer));
}

export async function POST() {
  return NextResponse.json(
    { error: "Customer creation is not available — customers are managed in BudgetApp via MyIntervals sync." },
    { status: 501 }
  );
}
