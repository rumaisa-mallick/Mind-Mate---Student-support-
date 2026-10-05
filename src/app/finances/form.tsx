"use client";

/**
 * Budget editor.
 *
 * Every figure is the student's own. Row names use the `field[]` array
 * convention so the action can zip parallel arrays by position — see
 * `src/app/finances/actions.ts`. A row with an amount of 0 is dropped on save
 * rather than stored as a zero.
 */

import { useActionState } from "react";

import { saveBudget, type BudgetState } from "./actions";

type IncomeRow = { label: string; monthly: number; stable: boolean };
type ExpenseRow = { code: string; label: string; monthly: number; essential: boolean };

export function BudgetForm({
  email,
  income,
  expenses,
  annualTuition,
  termsPerYear,
  bufferTargetMonths,
  hasPlan,
}: {
  email: string;
  income: IncomeRow[];
  expenses: ExpenseRow[];
  annualTuition: number;
  termsPerYear: number;
  bufferTargetMonths: number;
  hasPlan: boolean;
}) {
  const [state, formAction, pending] = useActionState<BudgetState, FormData>(saveBudget, {
    status: "idle",
  });

  const issues = state.issues ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="email" value={email} />

      <section className="mm-card p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Money coming in, each month</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Include anything reliable: family support, a scholarship instalment, a part-time wage.
          Mark irregular work as variable — we then warn you that a slow month is a risk.
        </p>

        <div className="mt-3 space-y-2">
          {income.length === 0 && (
            <p className="text-xs text-zinc-500">
              No income recorded. Add at least one source below.
            </p>
          )}
          {income.map((row, position) => (
            <div key={`income-${position}`} className="grid grid-cols-12 items-center gap-2">
              <input
                name="incomeLabel[]"
                defaultValue={row.label}
                placeholder="Source"
                maxLength={60}
                className="mm-input col-span-5"
              />
              <input
                name="incomeAmount[]"
                type="number"
                min={0}
                step={500}
                defaultValue={row.monthly || ""}
                placeholder="0"
                aria-label="Monthly amount in rupees"
                className="mm-input col-span-3"
              />
              <select
                name="incomeKind[]"
                defaultValue={row.stable ? "STABLE" : "VARIABLE"}
                aria-label="Reliability"
                className="mm-input col-span-4"
              >
                <option value="STABLE">Reliable every month</option>
                <option value="VARIABLE">Varies month to month</option>
              </select>
            </div>
          ))}
        </div>

        {/* Two blank rows so a new source can be added without any JavaScript. */}
        {[0, 1].map((offset) => (
          <div key={`income-new-${offset}`} className="grid grid-cols-12 items-center gap-2">
            <input
              name="incomeLabel[]"
              defaultValue=""
              placeholder="Add another source"
              maxLength={60}
              className="mm-input col-span-5"
            />
            <input
              name="incomeAmount[]"
              type="number"
              min={0}
              step={500}
              defaultValue=""
              placeholder="0"
              aria-label="Monthly amount in rupees"
              className="mm-input col-span-3"
            />
            <select
              name="incomeKind[]"
              defaultValue="STABLE"
              aria-label="Reliability"
              className="mm-input col-span-4"
            >
              <option value="STABLE">Reliable every month</option>
              <option value="VARIABLE">Varies month to month</option>
            </select>
          </div>
        ))}

        <p className="text-xs text-zinc-500">
          A row is only kept if you put an amount in it. Blank rows are discarded on save.
        </p>
      </section>

      <section className="mm-card p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Money going out, each month</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Mark a cost <strong>essential</strong> if it is not realistically cuttable. Essential
          costs are protected in the plan and drive the emergency buffer; everything else is only
          ever shown as an option, never as an instruction.
        </p>

        <table className="mm-table mt-3">
          <thead>
            <tr>
              <th>Cost</th>
              <th className="text-right">Per month</th>
              <th className="text-right">Essential?</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((row, position) => (
              <tr key={`expense-${position}`}>
                <td>
                  <input type="hidden" name="expenseCode[]" value={row.code} />
                  <input
                    name="expenseLabel[]"
                    defaultValue={row.label}
                    maxLength={60}
                    className="mm-input"
                  />
                </td>
                <td className="text-right">
                  <input
                    name="expenseMonthly[]"
                    type="number"
                    min={0}
                    step={500}
                    defaultValue={row.monthly || ""}
                    placeholder="0"
                    aria-label={`${row.label} monthly amount`}
                    className="mm-input text-right"
                  />
                </td>
                <td className="text-right">
                  <select
                    name="expenseEssential[]"
                    defaultValue={row.essential ? "YES" : "NO"}
                    aria-label={`${row.label} essential`}
                    className="mm-input"
                  >
                    <option value="YES">Essential</option>
                    <option value="NO">Optional</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mm-card p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Fees and safety margin</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tuition" className="text-xs font-medium text-zinc-900">
              Annual tuition in rupees
            </label>
            <input
              id="tuition"
              name="annualTuition"
              type="number"
              min={0}
              step={1000}
              defaultValue={annualTuition || ""}
              placeholder="0 if paid by an award"
              className="mm-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="terms" className="text-xs font-medium text-zinc-900">
              Fee instalments per year
            </label>
            <select id="terms" name="termsPerYear" defaultValue={termsPerYear} className="mm-input mt-1">
              <option value={1}>1 (paid yearly)</option>
              <option value={2}>2 (per semester)</option>
              <option value={3}>3</option>
              <option value={4}>4 (per trimester)</option>
            </select>
          </div>
          <div>
            <label htmlFor="buffer" className="text-xs font-medium text-zinc-900">
              Months of essential costs to keep as a buffer
            </label>
            <select
              id="buffer"
              name="bufferTargetMonths"
              defaultValue={bufferTargetMonths}
              className="mm-input mt-1"
            >
              {[1, 2, 3, 4, 6, 9, 12].map((months) => (
                <option key={months} value={months}>
                  {months} month{months > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        {issues.annualTuition && (
          <p className="mt-2 text-xs font-medium">⚠ Tuition: {issues.annualTuition}</p>
        )}
      </section>

      {state.status === "error" && (
        <p className="mm-card-flat p-4 text-sm font-medium text-zinc-900">⚠ {state.message}</p>
      )}
      {state.status === "saved" && (
        <p className="mm-card-flat border-l-4 border-l-zinc-900 p-4 text-sm font-medium text-zinc-900">
          ✓ {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="mm-btn" disabled={pending}>
          {pending ? "Recalculating…" : hasPlan ? "Update my plan" : "Build my plan"}
        </button>
        <p className="text-xs text-zinc-500">
          Only you see these figures. Nothing here is sent to your university or any administrator.
        </p>
      </div>
    </form>
  );
}