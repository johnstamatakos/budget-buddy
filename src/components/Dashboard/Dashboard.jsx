import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CATEGORIES, CATEGORY_COLORS } from '../../constants/categories.js';
import { formatCurrency } from '../../utils/formatters.js';
import './Dashboard.css';

export default function Dashboard({ transactions, monthlyIncome, onBack }) {
  const expenses = transactions.filter((t) => !t.isDeposit);
  const deposits = transactions.filter((t) => t.isDeposit);

  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
  const effectiveIncome = monthlyIncome > 0 ? monthlyIncome : totalDeposits;
  const remaining = effectiveIncome - totalExpenses;
  const spendingPct = effectiveIncome > 0 ? Math.min(100, (totalExpenses / effectiveIncome) * 100) : 0;

  const recurringTotal = useMemo(
    () => expenses.filter((t) => t.isRecurring).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [expenses]
  );

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of expenses) {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    }
    return CATEGORIES
      .filter((c) => map[c] > 0)
      .map((c) => ({ name: c, value: parseFloat(map[c].toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const recurringItems = useMemo(
    () => expenses.filter((t) => t.isRecurring).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    [expenses]
  );

  return (
    <div className="dashboard-page">
      <div className="dash-topbar">
        <button className="btn-ghost" onClick={onBack}>← Back to Transactions</button>
        <h1>Budget Dashboard</h1>
        <div /> {/* spacer */}
      </div>

      <div className="dash-content">
        {/* Top stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Spent</span>
            <span className="stat-value red">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{monthlyIncome > 0 ? 'Monthly Income' : 'Total Deposits'}</span>
            <span className="stat-value green">{formatCurrency(effectiveIncome)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Remaining</span>
            <span className={`stat-value ${remaining >= 0 ? 'green' : 'red'}`}>
              {remaining >= 0 ? '+' : ''}{formatCurrency(remaining)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Recurring / Month</span>
            <span className="stat-value purple">{formatCurrency(recurringTotal)}</span>
          </div>
        </div>

        {/* Spending bar */}
        {effectiveIncome > 0 && (
          <div className="spend-bar-card">
            <div className="spend-bar-header">
              <span>Spending vs Income</span>
              <span className={spendingPct > 100 ? 'over' : ''}>{spendingPct.toFixed(0)}%</span>
            </div>
            <div className="spend-bar-track">
              <div
                className={`spend-bar-fill ${spendingPct > 100 ? 'over' : spendingPct > 80 ? 'warn' : ''}`}
                style={{ width: `${Math.min(100, spendingPct)}%` }}
              />
            </div>
            <div className="spend-bar-labels">
              <span>{formatCurrency(totalExpenses)} spent</span>
              <span>{formatCurrency(effectiveIncome)} income</span>
            </div>
          </div>
        )}

        <div className="dash-columns">
          {/* Pie chart */}
          <div className="chart-card">
            <h2>Spending by Category</h2>
            {byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {byCategory.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Amount']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => <span style={{ fontSize: 13 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-chart">No expense data</p>
            )}
          </div>

          {/* Category breakdown */}
          <div className="breakdown-card">
            <h2>Category Breakdown</h2>
            <div className="breakdown-list">
              {byCategory.map((item) => (
                <div key={item.name} className="breakdown-row">
                  <div className="breakdown-dot" style={{ background: CATEGORY_COLORS[item.name] }} />
                  <span className="breakdown-name">{item.name}</span>
                  <span className="breakdown-bar-wrap">
                    <div
                      className="breakdown-bar"
                      style={{
                        width: `${(item.value / totalExpenses) * 100}%`,
                        background: CATEGORY_COLORS[item.name],
                      }}
                    />
                  </span>
                  <span className="breakdown-amount">{formatCurrency(item.value)}</span>
                  <span className="breakdown-pct">
                    {((item.value / totalExpenses) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recurring payments */}
        {recurringItems.length > 0 && (
          <div className="recurring-card">
            <h2>Recurring Payments <span className="sub">({recurringItems.length} found · {formatCurrency(recurringTotal)}/period)</span></h2>
            <div className="recurring-grid">
              {recurringItems.map((t) => (
                <div key={t.id} className="recurring-item">
                  <div className="recurring-dot" style={{ background: CATEGORY_COLORS[t.category] }} />
                  <div className="recurring-info">
                    <span className="recurring-name">{t.description}</span>
                    <span className="recurring-cat">{t.category}</span>
                  </div>
                  <span className="recurring-amount">{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
