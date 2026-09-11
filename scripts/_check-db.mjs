import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

const [budgets, customers, projects, mappings] = await Promise.all([
  prisma.budgetRecord.findMany({ select: { id: true, name: true, customerId: true, endDate: true } }),
  prisma.budgetCustomer.findMany({ select: { id: true, customerName: true, isActive: true } }),
  prisma.budgetProject.findMany({ select: { id: true, projectName: true, customerId: true, isActive: true } }),
  prisma.mapBudgetProject.findMany({ select: { budgetId: true, projectId: true } }),
]);

const now = new Date();
const activeCustomers = customers.filter(c => c.isActive);
const activeBudgets = budgets.filter(b => !b.endDate || b.endDate >= now);
const inactiveBudgets = budgets.filter(b => b.endDate && b.endDate < now);
const activeProjects = projects.filter(p => p.isActive);

console.log('=== CUSTOMERS ===');
console.log(`Total: ${customers.length} | Active: ${activeCustomers.length}`);
activeCustomers.forEach(c => console.log(`  [${c.id}] ${c.customerName}`));

console.log('\n=== BUDGETS ===');
console.log(`Total: ${budgets.length} | Active: ${activeBudgets.length} | Inactive: ${inactiveBudgets.length}`);
console.log('-- Active --');
activeBudgets.forEach(b => console.log(`  [${b.id}] ${b.name} (customer ${b.customerId})`));
console.log('-- Inactive (first 10) --');
inactiveBudgets.slice(0, 10).forEach(b => console.log(`  [${b.id}] ${b.name} ended ${b.endDate?.toISOString().split('T')[0]}`));

console.log('\n=== PROJECTS ===');
console.log(`Total: ${projects.length} | Active: ${activeProjects.length}`);
console.log('-- Active (first 20) --');
activeProjects.slice(0, 20).forEach(p => console.log(`  [${p.id}] ${p.projectName} (customer ${p.customerId})`));

console.log('\n=== MAP_BUDGET_PROJECT ===');
console.log(`Total mappings: ${mappings.length}`);
// Show which budgets have no projects
const budgetIdsWithProjects = new Set(mappings.map(m => m.budgetId));
const budgetsWithNoProjects = activeBudgets.filter(b => !budgetIdsWithProjects.has(b.id));
console.log(`Active budgets with no mapped projects: ${budgetsWithNoProjects.length}`);
budgetsWithNoProjects.forEach(b => console.log(`  [${b.id}] ${b.name}`));

await prisma.$disconnect();
