import { randomUUID } from 'crypto';

const VALID_CATEGORIES = [
  'Auto', 'Home', 'Utilities', 'Credit Cards', 'Student Loans',
  'Subscriptions', 'Shopping', 'Groceries', 'Restaurants', 'Other',
];

export function normalizeTransactions(rawTransactions) {
  return rawTransactions.map((t) => {
    const amount = parseFloat(t.amount) || 0;
    const isDeposit = amount > 0;

    let category = t.category || 'Other';
    if (!VALID_CATEGORIES.includes(category)) {
      category = 'Other';
    }

    // Parse and normalize date
    let date = t.date || '';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().split('T')[0];
      } else {
        date = '';
      }
    }

    return {
      id: randomUUID(),
      date,
      description: String(t.description || '').trim(),
      amount: parseFloat(amount.toFixed(2)),
      category: isDeposit ? 'Other' : category,
      isRecurring: Boolean(t.isRecurring),
      isDeposit,
    };
  }).filter((t) => t.description.length > 0 || t.amount !== 0);
}
