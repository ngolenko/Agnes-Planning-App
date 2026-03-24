import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: { client: true, projects: true },
  });
  if (!budget) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(budget);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const budget = await prisma.budget.update({ where: { id }, data: body });
  return NextResponse.json(budget);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.budget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
