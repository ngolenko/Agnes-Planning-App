import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: { client: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientId: body.clientId,
      fabricProjectId: body.fabricProjectId || null,
      dayRate: body.dayRate || null,
    },
  });
  return NextResponse.json(project, { status: 201 });
}
