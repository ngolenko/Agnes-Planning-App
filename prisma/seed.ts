import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import path from "path";

const db = new Database(path.join(process.cwd(), "dev.db"));

function cuid(): string {
  return randomBytes(12).toString("hex");
}

function now(): string {
  return new Date().toISOString();
}

// Clean existing data
db.exec("DELETE FROM Allocation");
db.exec("DELETE FROM TimeOff");
db.exec("DELETE FROM UnbillableTime");
db.exec("DELETE FROM Project");
db.exec("DELETE FROM Client");
db.exec("DELETE FROM Employee");

const ts = now();

// Employees
const employees = [
  { id: cuid(), name: "Max Müller", email: "max@company.com", role: "Senior Developer" },
  { id: cuid(), name: "Anna Schmidt", email: "anna@company.com", role: "Full-Stack Developer" },
  { id: cuid(), name: "Tom Weber", email: "tom@company.com", role: "Frontend Developer" },
  { id: cuid(), name: "Lisa Fischer", email: "lisa@company.com", role: "Backend Developer" },
  { id: cuid(), name: "Jan Bauer", email: "jan@company.com", role: "DevOps Engineer" },
  { id: cuid(), name: "Sarah Koch", email: "sarah@company.com", role: "UX Designer" },
];

const insertEmp = db.prepare(
  "INSERT INTO Employee (id, name, email, role, weeklyCapacityDays, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 5, 1, ?, ?)"
);
for (const e of employees) {
  insertEmp.run(e.id, e.name, e.email, e.role, ts, ts);
}

// Clients
const clients = [
  { id: cuid(), name: "Acme Corp" },
  { id: cuid(), name: "TechStart GmbH" },
  { id: cuid(), name: "Digital Solutions AG" },
];

const insertClient = db.prepare(
  "INSERT INTO Client (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)"
);
for (const c of clients) {
  insertClient.run(c.id, c.name, ts, ts);
}

// Projects
const projects = [
  { id: cuid(), name: "Platform Redesign", clientId: clients[0].id, dayRate: 1200 },
  { id: cuid(), name: "API Migration", clientId: clients[0].id, dayRate: 1100 },
  { id: cuid(), name: "Mobile App", clientId: clients[1].id, dayRate: 1300 },
  { id: cuid(), name: "Data Pipeline", clientId: clients[1].id, dayRate: 1000 },
  { id: cuid(), name: "E-Commerce Portal", clientId: clients[2].id, dayRate: 1150 },
];

const insertProj = db.prepare(
  "INSERT INTO Project (id, name, clientId, fabricProjectId, dayRate, isActive, createdAt, updatedAt) VALUES (?, ?, ?, NULL, ?, 1, ?, ?)"
);
for (const p of projects) {
  insertProj.run(p.id, p.name, p.clientId, p.dayRate, ts, ts);
}

// Get Mondays of current month using UTC to avoid timezone issues
const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

const mondays: string[] = [];
const d = new Date(Date.UTC(year, month, 1));
while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
while (d.getUTCMonth() === month) {
  mondays.push(d.toISOString());
  d.setUTCDate(d.getUTCDate() + 7);
}

// Allocations
const insertAlloc = db.prepare(
  "INSERT INTO Allocation (id, employeeId, projectId, weekStartDate, plannedDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

const allocationDefs = [
  { empIdx: 0, projIdx: 0, days: 3 },
  { empIdx: 0, projIdx: 1, days: 2 },
  { empIdx: 1, projIdx: 2, days: 4 },
  { empIdx: 1, projIdx: 3, days: 1 },
  { empIdx: 2, projIdx: 4, days: 3 },
  { empIdx: 2, projIdx: 0, days: 2 },
  { empIdx: 3, projIdx: 1, days: 3 },
  { empIdx: 3, projIdx: 3, days: 2 },
  { empIdx: 4, projIdx: 1, days: 2 },
  { empIdx: 4, projIdx: 3, days: 2 },
  { empIdx: 5, projIdx: 0, days: 2 },
  { empIdx: 5, projIdx: 4, days: 2 },
];

let allocCount = 0;
for (const def of allocationDefs) {
  for (const monday of mondays) {
    insertAlloc.run(
      cuid(),
      employees[def.empIdx].id,
      projects[def.projIdx].id,
      monday,
      def.days,
      ts,
      ts
    );
    allocCount++;
  }
}

// Time off
const insertTimeOff = db.prepare(
  "INSERT INTO TimeOff (id, employeeId, date, type, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

const timeOffDefs = [
  { empIdx: 1, day: 15, type: "vacation" },
  { empIdx: 1, day: 16, type: "vacation" },
  { empIdx: 1, day: 17, type: "vacation" },
  { empIdx: 4, day: 10, type: "sick" },
];

let timeOffCount = 0;
for (const t of timeOffDefs) {
  const date = new Date(Date.UTC(year, month, t.day));
  const dow = date.getUTCDay();
  if (dow !== 0 && dow !== 6) {
    insertTimeOff.run(cuid(), employees[t.empIdx].id, date.toISOString(), t.type, "confirmed", ts, ts);
    timeOffCount++;
  }
}

// Unbillable time
const insertUnbillable = db.prepare(
  "INSERT INTO UnbillableTime (id, employeeId, weekStartDate, category, plannedDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

if (mondays.length > 0) {
  insertUnbillable.run(cuid(), employees[4].id, mondays[0], "internal", 1, ts, ts);
  insertUnbillable.run(cuid(), employees[5].id, mondays[0], "training", 1, ts, ts);
}

console.log("Seed data created successfully!");
console.log(`- ${employees.length} employees`);
console.log(`- ${clients.length} clients`);
console.log(`- ${projects.length} projects`);
console.log(`- ${allocCount} allocations`);
console.log(`- ${timeOffCount} time-off entries`);
console.log(`- 2 unbillable entries`);

db.close();
