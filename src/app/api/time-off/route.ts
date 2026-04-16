// @ts-nocheck
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
  let timeOff = await prisma.timeOff.findMany({
    where,
    include: { employee: true },
    orderBy: { date: "asc" },
  });

  if (startDate || endDate) {
    const start = startDate ? new Date(startDate).getTime() : -Infinity;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    timeOff = timeOff.filter((t) => {
      const d = new Date(t.date).getTime();
      return d >= start && d <= end;
    });
  }

  return NextResponse.json(timeOff);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Support batch creation with startDate + endDate range
  if (body.startDate && body.endDate) {
    // Parse YYYY-MM-DD inputs deterministically as UTC midnight, so
    // the iteration/weekday-check and storage ISO strings don't drift
    // across server/client timezones.
    const parseUTC = (v: string): Date => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
      if (m) {
        return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      }
      const d = new Date(v);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    const start = parseUTC(body.startDate);
    const end = parseUTC(body.endDate);
    const created = [];

    const current = new Date(start);
    while (current.getTime() <= end.getTime()) {
      const dow = current.getUTCDay();
      // Skip weekends
      if (dow !== 0 && dow !== 6) {
        const isoDate = new Date(current.getTime());
        const result = await prisma.timeOff.upsert({
          where: {
            employeeId_date: {
              employeeId: body.employeeId,
              date: isoDate,
            },
          },
          update: { type: body.type, status: body.status || "planned" },
          create: {
            employeeId: body.employeeId,
            date: isoDate,
            type: body.type,
            status: body.status || "planned",
          },
        });
        created.push(result);
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return NextResponse.json(created, { status: 201 });
  }

  // Single date creation (backward compatible)
  const timeOff = await prisma.timeOff.upsert({
    where: {
      employeeId_date: {
        employeeId: body.employeeId,
        date: new Date(body.date),
      },
    },
    update: { type: body.type, status: body.status || "planned" },
    create: {
      employeeId: body.employeeId,
      date: new Date(body.date),
      type: body.type,
      status: body.status || "planned",
    },
  });
  return NextResponse.json(timeOff, { status: 201 });
}
