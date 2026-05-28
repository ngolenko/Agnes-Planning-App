import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const projects = await prisma.budgetProject.findMany({
    where: { isActive: true },
    include: { customer: true },
    orderBy: { projectName: "asc" },
  });
  return NextResponse.json(
    projects.map((p) => ({
      id: String(p.id),
      name: p.projectName ?? "",
      clientId: String(p.customerId ?? ""),
      fabricProjectId: String(p.id),
      budgetDays: null,
      isActive: true,
      lastInvoiceDate: p.lastInvoiceDate?.toISOString() ?? null,
      client: p.customer
        ? { id: String(p.customer.id), name: p.customer.customerName ?? "" }
        : null,
    }))
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Project creation is not available — projects are managed in BudgetApp via MyIntervals sync." },
    { status: 501 }
  );
}
