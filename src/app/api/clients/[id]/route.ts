import { NextRequest, NextResponse } from "next/server";

export async function PUT() {
  return NextResponse.json(
    { error: "Customer edits are not available — customers are managed in BudgetApp." },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Customer deletes are not available — customers are managed in BudgetApp." },
    { status: 501 }
  );
}
