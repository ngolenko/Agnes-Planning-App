import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;

  // Fetch all matching records and filter dates client-side for reliability
  // with SQLite date handling (Prisma gte/lte can miss records)
  let unbillable = await prisma.unbillableTime.findMany({
    where,
    include: { employee: true },
    orderBy: { weekStartDate: "asc" },
  });

  if (startDate || endDate) {
    const start = startDate ? new Date(startDate).getTime() : -Infinity;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    unbillable = unbillable.filter((u) => {
      const d = new Date(u.weekStartDate).getTime();
      return d >= start && d <= end;
    });
  }

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
