import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (startDate || endDate) {
    where.weekStartDate = {};
    if (startDate) (where.weekStartDate as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.weekStartDate as Record<string, unknown>).lte = new Date(endDate);
  }

  const unbillable = await prisma.unbillableTime.findMany({
    where,
    include: { employee: true },
    orderBy: { weekStartDate: "asc" },
  });
  return NextResponse.json(unbillable);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const unbillable = await prisma.unbillableTime.upsert({
    where: {
      employeeId_weekStartDate_category: {
        employeeId: body.employeeId,
        weekStartDate: new Date(body.weekStartDate),
        category: body.category,
      },
    },
    update: { plannedDays: body.plannedDays },
    create: {
      employeeId: body.employeeId,
      weekStartDate: new Date(body.weekStartDate),
      category: body.category,
      plannedDays: body.plannedDays,
    },
  });
  return NextResponse.json(unbillable, { status: 201 });
}
