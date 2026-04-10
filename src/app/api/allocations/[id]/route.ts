// @ts-nocheck
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const allocation = await prisma.allocation.update({ where: { id }, data: { plannedDays: body.plannedDays } });
  return NextResponse.json(allocation);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.allocation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
