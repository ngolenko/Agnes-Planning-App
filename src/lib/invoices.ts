import { prisma } from "@/lib/db";

// Hours per billable day. Budgets and invoices are stored in hours; the UI shows days.
export const HOURS_PER_DAY = 8;

export interface InvoicedHours {
  /** Total invoiced hours per budget id (budget.Invoice.BudgetId). */
  byBudget: Map<number, number>;
  /** Invoiced hours per `${budgetId}:${projectId}` for the per-project breakdown. */
  byBudgetProject: Map<string, number>;
}

/**
 * Aggregate real invoiced hours from budget.Invoice for the given budgets.
 *
 * "Invoiced So Far" is actual billing data — NOT derived from Agnes planning
 * allocations (those are forward-looking and would be ~0 before historical invoice dates).
 */
export async function getInvoicedHours(budgetIds: number[]): Promise<InvoicedHours> {
  const byBudget = new Map<number, number>();
  const byBudgetProject = new Map<string, number>();
  if (budgetIds.length === 0) return { byBudget, byBudgetProject };

  const invoices = await prisma.budgetInvoice.findMany({
    where: { budgetId: { in: budgetIds } },
    select: { budgetId: true, projectId: true, invoicedH: true },
  });

  for (const inv of invoices) {
    if (inv.budgetId == null) continue;
    const h = inv.invoicedH != null ? Number(inv.invoicedH) : 0;
    byBudget.set(inv.budgetId, (byBudget.get(inv.budgetId) ?? 0) + h);
    if (inv.projectId != null) {
      const key = `${inv.budgetId}:${inv.projectId}`;
      byBudgetProject.set(key, (byBudgetProject.get(key) ?? 0) + h);
    }
  }
  return { byBudget, byBudgetProject };
}
