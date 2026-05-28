import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const employees = [
  {
    name: "Alexandru Abrudan",
    email: "aabrudan@multibase.de",
    role: "BI Developer",
    country: "RO",
    weeklyCapacityDays: 5,
  },
  {
    name: "Alexandru Banda",
    email: "abanda@multibase.de",
    role: "Junior BI Consultant",
    country: "RO",
    weeklyCapacityDays: 5,
  },
  {
    name: "Bruno de Assis Pereira",
    email: "bpereira@multibase.de",
    role: "BI Consultant / Technical Lead",
    country: "DE",
    weeklyCapacityDays: 5,
  },
  {
    name: "Ionut Danciu",
    email: "idanciu@multibase.de",
    role: "Senior BI Consultant",
    country: "RO",
    weeklyCapacityDays: 5,
  },
  {
    name: "Kanishka Chaudhary",
    email: "kchaudhary@multibase.de",
    role: "BI Architect",
    country: "DE",
    weeklyCapacityDays: 5,
  },
  {
    name: "Martin Cremer",
    email: "mcremer@multibase.de",
    role: "Technical Lead",
    country: "DE",
    weeklyCapacityDays: 5,
  },
  {
    name: "Mariia Samsonova",
    email: "msamsonova@multibase.de",
    role: "Senior BI Consultant",
    country: "DE",
    weeklyCapacityDays: 5,
  },
  {
    name: "Pooja Muvvala",
    email: "pmuvvala@multibase.de",
    role: "BI Consultant",
    country: "DE",
    weeklyCapacityDays: 5,
  },
  {
    name: "Syed Sameer Iqbal Fatmi",
    email: "sfatmi@multibase.de",
    role: "Senior BI Consultant",
    country: "DE",
    weeklyCapacityDays: 5,
  },
  {
    name: "Stefan Ruff",
    email: "sruff@multibase.de",
    role: "Senior BI Backend Developer",
    country: "DE",
    weeklyCapacityDays: 5,
  },
];

async function main() {
  console.log("Seeding employees...");
  for (const emp of employees) {
    const result = await prisma.employee.upsert({
      where: { email: emp.email },
      update: { name: emp.name, role: emp.role, country: emp.country, weeklyCapacityDays: emp.weeklyCapacityDays },
      create: emp,
    });
    console.log(`  ${result.isActive ? "✓" : "–"} ${result.name} (${result.email})`);
  }
  console.log(`Done. ${employees.length} employees upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
