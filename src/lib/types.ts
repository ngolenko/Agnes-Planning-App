export type CountryCode = "DE" | "RO";

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  country: CountryCode;
  weeklyCapacityDays: number;
  isActive: boolean;
}

export interface Client {
  id: string;
  name: string;
  projects?: Project[];
  budgets?: Budget[];
}

export interface Budget {
  id: string;
  name: string;
  clientId: string;
  budgetDays: number | null;
  fabricBudgetId: string | null;
  lastInvoiceDate: string | null;
  isActive: boolean;
  client?: Client;
  projects?: Project[];
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  budgetId: string | null;
  fabricProjectId: string | null;
  budgetDays: number | null;
  isActive: boolean;
  client?: Client;
  budget?: Budget;
}

export interface Allocation {
  id: string;
  employeeId: string;
  projectId: string;
  weekStartDate: string;
  plannedDays: number;
  employee?: Employee;
  project?: Project & { client?: Client };
}

export interface TimeOff {
  id: string;
  employeeId: string;
  date: string;
  type: "vacation" | "sick" | "public_holiday";
  status: "planned" | "confirmed";
}

export interface UnbillableTime {
  id: string;
  employeeId: string;
  weekStartDate: string;
  category: "internal" | "training" | "bench" | "admin";
  plannedDays: number;
}

export interface PlanningData {
  employees: Employee[];
  allocations: Allocation[];
  prevAllocations: Allocation[];
  timeOff: TimeOff[];
  unbillable: UnbillableTime[];
  projects: (Project & { client: Client })[];
  clients: (Client & { projects: Project[] })[];
  budgets: (Budget & { client: Client; projects: Project[] })[];
  allAllocations: Allocation[];
  period: { year: number; month: number };
}
