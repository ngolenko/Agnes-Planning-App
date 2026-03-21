import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const projectId = searchParams.get("projectId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (projectId) where.projectId = projectId;
  if (startDate || endDate) {
    where.weekStartDate = {};
    if (startDate) (where.weekStartDate as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.weekStartDate as Record<string, unknown>).lte = new Date(endDate);
  }

  const allocations = await prisma.allocation.findMany({
    where,
    include: { employee: true, project: { include: { client: true } } },
    orderBy: { weekStartDate: "asc" },
  });
  return NextResponse.json(allocations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const allocation = await prisma.allocation.upsert({
    where: {
      employeeId_projectId_weekStartDate: {
        employeeId: body.employeeId,
        projectId: body.projectId,
        weekStartDate: new Date(body.weekStartDate),
      },
    },
    update: { plannedDays: body.plannedDays },
    create: {
      employeeId: body.employeeId,
      projectId: body.projectId,
      weekStartDate: new Date(body.weekStartDate),
      plannedDays: body.plannedDays,
    },
  });
  return NextResponse.json(allocation, { status: 201 });
}
