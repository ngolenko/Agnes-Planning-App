// @ts-nocheck
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const clients = await prisma.client.findMany({
    include: { projects: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const client = await prisma.client.create({
    data: { name: body.name },
  });
  return NextResponse.json(client, { status: 201 });
}
