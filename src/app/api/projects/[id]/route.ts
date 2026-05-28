import { NextResponse } from "next/server";

export async function PUT() {
  return NextResponse.json(
    { error: "Project edits are not available — projects are managed in BudgetApp via MyIntervals sync." },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Project deletes are not available — projects are managed in BudgetApp via MyIntervals sync." },
    { status: 501 }
  );
}
