import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(employees);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const employee = await prisma.employee.create({
    data: {
      name: body.name,
      email: body.email,
      role: body.role || "",
      weeklyCapacityDays: body.weeklyCapacityDays ?? 5,
    },
  });
  return NextResponse.json(employee, { status: 201 });
}
