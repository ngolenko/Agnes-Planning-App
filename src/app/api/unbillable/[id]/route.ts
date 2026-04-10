// @ts-nocheck
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.unbillableTime.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
