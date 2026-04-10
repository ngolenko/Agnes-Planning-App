/**
 * In-memory Prisma-compatible data store for demo/prototype mode.
 * No database required — data initializes from demo-data.json.
 * Writes work in-memory but reset on cold start (fine for demo).
 */

import demoData from "./demo-data.json";
import { randomBytes } from "crypto";

function cuid(): string {
  return randomBytes(12).toString("hex");
}

// ── In-memory tables ──────────────────────────────────────────────────
// Deep-clone so we can mutate without affecting the import
const tables = {
  employees: JSON.parse(JSON.stringify(demoData.employees)) as Row[],
  clients: JSON.parse(JSON.stringify(demoData.clients)) as Row[],
  budgets: JSON.parse(JSON.stringify(demoData.budgets)) as Row[],
  projects: JSON.parse(JSON.stringify(demoData.projects)) as Row[],
  allocations: JSON.parse(JSON.stringify(demoData.allocations)) as Row[],
  timeOffs: JSON.parse(JSON.stringify(demoData.timeOffs)) as Row[],
  unbillableTimes: JSON.parse(JSON.stringify(demoData.unbillableTimes)) as Row[],
};

type Row = Record<string, unknown>;
type Table = Row[];

// ── Normalization ─────────────────────────────────────────────────────
// Dates are stored as ISO strings. Incoming values may be Date objects
// (because API routes wrap with `new Date(...)`) so we normalize before
// comparison/storage to avoid type mismatches.
function normalizeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v;
}

function normalizeData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = normalizeValue(v);
  }
  return out;
}

function toComparable(v: unknown): string | number | undefined {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" || typeof v === "number") return v;
  return String(v);
}

// ── Helpers ───────────────────────────────────────────────────────────

function matchWhere(row: Row, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      const ops = val as Record<string, unknown>;
      const hasRange = "gte" in ops || "lte" in ops || "gt" in ops || "lt" in ops;
      if (hasRange) {
        const rowVal = toComparable(row[key]);
        if ("gte" in ops) {
          const cmp = toComparable(ops.gte);
          if (rowVal === undefined || cmp === undefined || rowVal < cmp) return false;
        }
        if ("gt" in ops) {
          const cmp = toComparable(ops.gt);
          if (rowVal === undefined || cmp === undefined || rowVal <= cmp) return false;
        }
        if ("lte" in ops) {
          const cmp = toComparable(ops.lte);
          if (rowVal === undefined || cmp === undefined || rowVal > cmp) return false;
        }
        if ("lt" in ops) {
          const cmp = toComparable(ops.lt);
          if (rowVal === undefined || cmp === undefined || rowVal >= cmp) return false;
        }
      } else {
        // Composite unique key (e.g. { employeeId_date: { employeeId, date } })
        for (const [subKey, subVal] of Object.entries(ops)) {
          const rowVal = toComparable(row[subKey]);
          const cmp = toComparable(subVal);
          if (rowVal !== cmp) return false;
        }
      }
    } else {
      const rowVal = toComparable(row[key]);
      const cmp = toComparable(val);
      if (rowVal !== cmp) return false;
    }
  }
  return true;
}

function sortBy(arr: Row[], orderBy?: Record<string, string>): Row[] {
  if (!orderBy) return arr;
  const key = Object.keys(orderBy)[0];
  const dir = orderBy[key] === "desc" ? -1 : 1;
  return [...arr].sort((a, b) => {
    const va = a[key] as string;
    const vb = b[key] as string;
    return va < vb ? -dir : va > vb ? dir : 0;
  });
}

function applyIncludes(row: Row, include?: Record<string, unknown>): Row {
  if (!include) return { ...row };
  const result = { ...row };
  for (const [rel, relOpts] of Object.entries(include)) {
    if (!relOpts) continue;
    const relConf = typeof relOpts === "object" ? (relOpts as Record<string, unknown>) : {};
    const relWhere = relConf.where as Record<string, unknown> | undefined;

    // Resolve relation based on naming conventions
    if (rel === "employee") {
      result.employee = tables.employees.find((e) => e.id === row.employeeId) || null;
    } else if (rel === "client") {
      result.client = tables.clients.find((c) => c.id === row.clientId) || null;
    } else if (rel === "budget") {
      result.budget = tables.budgets.find((b) => b.id === row.budgetId) || null;
    } else if (rel === "projects") {
      // Projects can be included on a Client (match by clientId) OR on a Budget (match by budgetId).
      // cuids don't collide across tables so OR is safe here.
      let projs = tables.projects.filter((p) => {
        const matches = p.clientId === row.id || p.budgetId === row.id;
        if (!matches) return false;
        return matchWhere(p, relWhere);
      });
      // Recursively apply includes on projects
      if (relConf.include) {
        projs = projs.map((p) => applyIncludes(p, relConf.include as Record<string, unknown>));
      }
      result.projects = projs;
    } else if (rel === "project") {
      const proj = tables.projects.find((p) => p.id === row.projectId) || null;
      if (proj && relConf.include) {
        result.project = applyIncludes(proj, relConf.include as Record<string, unknown>);
      } else {
        result.project = proj;
      }
    } else if (rel === "budgets") {
      result.budgets = tables.budgets.filter((b) => b.clientId === row.id);
    } else if (rel === "allocations") {
      result.allocations = tables.allocations.filter(
        (a) => a.employeeId === row.id || a.projectId === row.id,
      );
    }
  }
  return result;
}

// ── Model factory ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createModel(table: Table, tableName: string): any {
  return {
    findMany: async (opts?: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
      orderBy?: Record<string, string>;
    }) => {
      let results = table.filter((r) => matchWhere(r, opts?.where));
      results = sortBy(results, opts?.orderBy);
      return results.map((r) => applyIncludes(r, opts?.include));
    },

    findUnique: async (opts: { where: { id: string }; include?: Record<string, unknown> }) => {
      const row = table.find((r) => r.id === opts.where.id);
      if (!row) return null;
      return applyIncludes(row, opts?.include);
    },

    findFirst: async (opts?: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
      orderBy?: Record<string, string>;
    }) => {
      let results = table.filter((r) => matchWhere(r, opts?.where));
      results = sortBy(results, opts?.orderBy);
      const first = results[0];
      if (!first) return null;
      return applyIncludes(first, opts?.include);
    },

    create: async (opts: { data: Record<string, unknown> }) => {
      const now = new Date().toISOString();
      const row: Row = {
        id: cuid(),
        ...normalizeData(opts.data),
        createdAt: now,
        updatedAt: now,
      };
      table.push(row);
      return row;
    },

    update: async (opts: { where: { id: string }; data: Record<string, unknown> }) => {
      const idx = table.findIndex((r) => r.id === opts.where.id);
      if (idx === -1) throw new Error(`${tableName} not found`);
      table[idx] = {
        ...table[idx],
        ...normalizeData(opts.data),
        updatedAt: new Date().toISOString(),
      };
      return table[idx];
    },

    delete: async (opts: { where: { id: string } }) => {
      const idx = table.findIndex((r) => r.id === opts.where.id);
      if (idx === -1) throw new Error(`${tableName} not found`);
      const [deleted] = table.splice(idx, 1);
      return deleted;
    },

    deleteMany: async (opts?: { where?: Record<string, unknown> }) => {
      let count = 0;
      for (let i = table.length - 1; i >= 0; i--) {
        if (matchWhere(table[i], opts?.where)) {
          table.splice(i, 1);
          count++;
        }
      }
      return { count };
    },

    upsert: async (opts: {
      where: Record<string, unknown>;
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => {
      // Flatten composite unique keys: { employeeId_projectId_weekStartDate: {...} } → {...}
      const whereFlat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(opts.where)) {
        if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
          Object.assign(whereFlat, v as Record<string, unknown>);
        } else {
          whereFlat[k] = v;
        }
      }
      const existing = table.find((r) => matchWhere(r, whereFlat));
      if (existing) {
        Object.assign(existing, normalizeData(opts.update), {
          updatedAt: new Date().toISOString(),
        });
        return existing;
      }
      const now = new Date().toISOString();
      const row: Row = {
        id: cuid(),
        ...normalizeData(opts.create),
        createdAt: now,
        updatedAt: now,
      };
      table.push(row);
      return row;
    },

    count: async (opts?: { where?: Record<string, unknown> }) => {
      return table.filter((r) => matchWhere(r, opts?.where)).length;
    },
  };
}

// ── Prisma-compatible export ──────────────────────────────────────────

export const prisma = {
  employee: createModel(tables.employees, "Employee"),
  client: createModel(tables.clients, "Client"),
  budget: createModel(tables.budgets, "Budget"),
  project: createModel(tables.projects, "Project"),
  allocation: createModel(tables.allocations, "Allocation"),
  timeOff: createModel(tables.timeOffs, "TimeOff"),
  unbillableTime: createModel(tables.unbillableTimes, "UnbillableTime"),
};
