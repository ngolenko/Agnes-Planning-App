import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function normalizeAllocation(a: {
  id: string;
  employeeId: string;
  projectId: number;
  weekStartDate: Date;
  plannedDays: number;
  createdAt: Date;
  updatedAt: Date;
  employee?: { id: string; name: string; email: string; role: string; country: string; weeklyCapacityDays: number; isActive: boolean } | null;
  project?: {
    id: number;
    projectName: string | null;
    customerId: number | null;
    customer?: { id: number; customerName: string | null } | null;
  } | null;
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
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const projectId = searchParams.get("projectId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (projectId) {
    const numId = parseInt(projectId);
    if (!isNaN(numId)) where.projectId = numId;
  }
  if (startDate || endDate) {
    where.weekStartDate = {};
    if (startDate) (where.weekStartDate as Record<string, unknown>).gte = new Date(startDate + "T00:00:00.000Z");
    if (endDate) (where.weekStartDate as Record<string, unknown>).lte = new Date(endDate + "T00:00:00.000Z");
  }

  const allocations = await prisma.allocation.findMany({
    where,
    include: { employee: true, project: { include: { customer: true } } },
    orderBy: { weekStartDate: "asc" },
  });
  return NextResponse.json(allocations.map(normalizeAllocation));
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const projectId = parseInt(body.projectId);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const allocation = await prisma.allocation.upsert({
    where: {
      employeeId_projectId_weekStartDate: {
        employeeId: body.employeeId,
        projectId,
        weekStartDate: new Date(body.weekStartDate + "T00:00:00.000Z"),
      },
    },
    update: { plannedDays: body.plannedDays },
    create: {
      employeeId: body.employeeId,
      projectId,
      weekStartDate: new Date(body.weekStartDate + "T00:00:00.000Z"),
      plannedDays: body.plannedDays,
    },
  });
  return NextResponse.json({ ...allocation, projectId: String(allocation.projectId) }, { status: 201 });
}
