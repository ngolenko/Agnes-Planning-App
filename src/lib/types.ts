export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  weeklyCapacityDays: number;
  isActive: boolean;
}

export interface Client {
  id: string;
  name: string;
  projects?: Project[];
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  fabricProjectId: string | null;
  dayRate: number | null;
  budgetDays: number | null;
  isActive: boolean;
  client?: Client;
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
  allAllocations: Allocation[];
  period: { year: number; month: number };
}
