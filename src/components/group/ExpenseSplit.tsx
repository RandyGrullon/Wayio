import { formatCurrency } from '@/lib/utils/formatters'
import type { User } from '@/types/user'

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  paidBy: string
  paidByName?: string
  splitAmong: string[]
}

interface ExpenseSplitProps {
  expenses: Expense[]
  members: User[]
}

export function ExpenseSplit({ expenses, members }: ExpenseSplitProps) {
  const memberMap = new Map(members.map((m) => [m.id, m.name]))

  const balances = new Map<string, number>()
  for (const member of members) balances.set(member.id, 0)

  for (const expense of expenses) {
    const share = expense.amount / expense.splitAmong.length
    balances.set(
      expense.paidBy,
      (balances.get(expense.paidBy) ?? 0) + expense.amount
    )
    for (const userId of expense.splitAmong) {
      balances.set(userId, (balances.get(userId) ?? 0) - share)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="flex justify-between rounded-xl bg-surface-muted px-3 py-2.5 text-sm"
          >
            <span className="text-fg">{expense.description}</span>
            <span className="font-bold text-fg">
              {formatCurrency(expense.amount, expense.currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-bold text-fg">Balances</p>
        {Array.from(balances.entries()).map(([userId, balance]) => (
          <div key={userId} className="flex justify-between py-0.5 text-sm">
            <span className="text-fg-muted">
              {memberMap.get(userId) ?? userId}
            </span>
            <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
              {balance >= 0 ? '+' : ''}
              {formatCurrency(balance, 'USD')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
