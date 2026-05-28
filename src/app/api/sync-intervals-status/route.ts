import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const INTERVALS_BASE = "https://api.myintervals.com";

async function fetchAll(path: string): Promise<unknown[]> {
  const res = await fetch(`${INTERVALS_BASE}${path}`, {
    headers: { Authorization: process.env.INTERVALS_API_KEY! },
  });
  if (!res.ok) throw new Error(`Intervals API ${path} → ${res.status} ${res.statusText}`);
  const json = await res.json() as Record<string, unknown>;
  // Intervals wraps results in a key matching the resource name (e.g. { project: [...] })
  const key = Object.keys(json).find((k) => Array.isArray(json[k]));
  return key ? (json[key] as unknown[]) : [];
}

export async function POST() {
  const [intervalsProjects, intervalsClients] = await Promise.all([
    fetchAll("/project/?limit=0"),
    fetchAll("/client/?limit=0"),
  ]);

  // Intervals `active` field is "t" = active, "f" = inactive
  // DB id = Intervals `localidunpadded` (not the large Intervals `id`)
  type IntervalsRecord = { id: string; localidunpadded: string; active: string };

  const projectUpdates = await Promise.all(
    (intervalsProjects as IntervalsRecord[]).map((p) =>
      prisma.budgetProject.updateMany({
        where: { id: parseInt(p.localidunpadded) },
        data: { isActive: p.active === "t" },
      })
    )
  );

  const clientUpdates = await Promise.all(
    (intervalsClients as IntervalsRecord[]).map((c) =>
      prisma.budgetCustomer.updateMany({
        where: { id: parseInt(c.localidunpadded) },
        data: { isActive: c.active === "t" },
      })
    )
  );

  const inactiveProjects = (intervalsProjects as IntervalsRecord[]).filter((p) => p.active !== "t").length;
  const inactiveClients = (intervalsClients as IntervalsRecord[]).filter((c) => c.active !== "t").length;

  return NextResponse.json({
    projects: { total: intervalsProjects.length, inactive: inactiveProjects, updated: projectUpdates.length },
    clients: { total: intervalsClients.length, inactive: inactiveClients, updated: clientUpdates.length },
  });
}
