import { useState, useEffect } from 'react';
import { CATEGORIES } from '../../constants/categories.js';
import './RulesPage.css';

// Normalise stored rule value to { category, isRecurring }
function toRule(value) {
  if (typeof value === 'string') return { category: value, isRecurring: false };
  return value;
}

export default function RulesPage() {
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit state
  const [editingKey, setEditingKey] = useState(null);
  const [editForm, setEditForm] = useState({ category: '', isRecurring: false });

  // Refine state
  const [refineState, setRefineState] = useState('idle'); // idle | loading | done | error
  const [refineResult, setRefineResult] = useState(null);
  const [toDelete, setToDelete] = useState(new Set()); // keys checked for deletion

  const load = () =>
    fetch('/api/rules')
      .then((r) => r.json())
      .then((data) => setRules(data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (key) => {
    await fetch(`/api/rules/${encodeURIComponent(key)}`, { method: 'DELETE' });
    setRules((prev) => { const next = { ...prev }; delete next[key]; return next; });
    if (editingKey === key) setEditingKey(null);
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const startEdit = (key, rule) => {
    setEditingKey(key);
    setEditForm({ category: rule.category, isRecurring: rule.isRecurring });
  };

  const cancelEdit = () => setEditingKey(null);

  const saveEdit = async () => {
    const { category, isRecurring } = editForm;
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: editingKey, category, isRecurring }),
    });
    setRules((prev) => ({ ...prev, [editingKey]: { category, isRecurring } }));
    setEditingKey(null);
  };

  // ── Refine ──────────────────────────────────────────────────────────────────
  const runRefine = async () => {
    setRefineState('loading');
    setRefineResult(null);
    try {
      const res = await fetch('/api/rules/refine', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refine failed.');
      setRefineResult(data);
      // Pre-check all redundant keys for deletion
      setToDelete(new Set((data.redundant || []).map((r) => r.key)));
      setRefineState('done');
    } catch (err) {
      setRefineResult({ error: err.message });
      setRefineState('error');
    }
  };

  const applyRefine = async () => {
    await Promise.all(
      [...toDelete].map((key) =>
        fetch(`/api/rules/${encodeURIComponent(key)}`, { method: 'DELETE' })
      )
    );
    setRules((prev) => {
      const next = { ...prev };
      for (const key of toDelete) delete next[key];
      return next;
    });
    setRefineState('idle');
    setRefineResult(null);
    setToDelete(new Set());
  };

  const toggleToDelete = (key) =>
    setToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // ── Table entries ───────────────────────────────────────────────────────────
  const entries = Object.entries(rules)
    .map(([merchant, value]) => ({ merchant, ...toRule(value) }))
    .filter(({ merchant, category }) =>
      !search.trim() ||
      merchant.toLowerCase().includes(search.toLowerCase()) ||
      category.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.merchant.localeCompare(b.merchant));

  const hasRefineFindings =
    refineResult &&
    (refineResult.redundant?.length > 0 ||
      refineResult.conflicts?.length > 0 ||
      refineResult.semanticDuplicates?.length > 0);

  return (
    <div className="rules-page">
      {/* ── Header ── */}
      <div className="rules-header">
        <div className="rules-header-left">
          <h1>Rules</h1>
          {!loading && <span className="rules-count">{Object.keys(rules).length} rules</span>}
        </div>
        <input
          className="rules-search"
          type="text"
          placeholder="Search merchant or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="rules-refine-btn"
          onClick={runRefine}
          disabled={refineState === 'loading' || Object.keys(rules).length < 2}
          title="Let AI find redundant or conflicting rules"
        >
          {refineState === 'loading' ? '…' : '✦ Refine with AI'}
        </button>
      </div>

      {/* ── Refine panel ── */}
      {refineState !== 'idle' && (
        <div className="rules-refine-panel">
          {refineState === 'loading' && (
            <p className="rules-refine-status">Analyzing rules…</p>
          )}

          {refineState === 'error' && (
            <p className="rules-refine-status error">{refineResult?.error}</p>
          )}

          {refineState === 'done' && (
            <>
              {refineResult?.summary && (
                <p className="rules-refine-summary">{refineResult.summary}</p>
              )}

              {!hasRefineFindings && (
                <p className="rules-refine-status">No redundancies or conflicts found — your rules look clean.</p>
              )}

              {refineResult?.redundant?.length > 0 && (
                <div className="rules-refine-section">
                  <h3>Redundant rules <span className="rules-refine-badge">{refineResult.redundant.length}</span></h3>
                  <p className="rules-refine-hint">These are already covered by a more general rule. Safe to delete.</p>
                  {refineResult.redundant.map((r) => (
                    <label key={r.key} className="rules-refine-row">
                      <input
                        type="checkbox"
                        checked={toDelete.has(r.key)}
                        onChange={() => toggleToDelete(r.key)}
                      />
                      <span className="rules-refine-key">{r.key}</span>
                      <span className="rules-refine-arrow">→ covered by</span>
                      <span className="rules-refine-key covered">{r.coveredBy}</span>
                      <span className="rules-refine-reason">{r.reason}</span>
                    </label>
                  ))}
                </div>
              )}

              {refineResult?.conflicts?.length > 0 && (
                <div className="rules-refine-section">
                  <h3>Category conflicts <span className="rules-refine-badge warn">{refineResult.conflicts.length}</span></h3>
                  <p className="rules-refine-hint">Same merchant, different categories. The more specific rule wins.</p>
                  {refineResult.conflicts.map((c, i) => (
                    <div key={i} className="rules-refine-conflict">
                      <span className="rules-refine-key">{c.specificKey}</span>
                      <span className="rules-refine-cat">{c.specificCategory}</span>
                      <span className="rules-refine-arrow">overrides</span>
                      <span className="rules-refine-key">{c.generalKey}</span>
                      <span className="rules-refine-cat">{c.generalCategory}</span>
                    </div>
                  ))}
                </div>
              )}

              {refineResult?.semanticDuplicates?.length > 0 && (
                <div className="rules-refine-section">
                  <h3>Possible duplicates <span className="rules-refine-badge info">{refineResult.semanticDuplicates.length}</span></h3>
                  <p className="rules-refine-hint">May refer to the same merchant — review and consolidate manually.</p>
                  {refineResult.semanticDuplicates.map((d, i) => (
                    <div key={i} className="rules-refine-conflict">
                      {d.keys.map((k) => (
                        <span key={k} className="rules-refine-key">{k}</span>
                      ))}
                      <span className="rules-refine-reason">{d.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rules-refine-actions">
                {toDelete.size > 0 && (
                  <button className="rules-refine-apply" onClick={applyRefine}>
                    Delete {toDelete.size} rule{toDelete.size !== 1 ? 's' : ''}
                  </button>
                )}
                <button className="rules-refine-close" onClick={() => { setRefineState('idle'); setRefineResult(null); setToDelete(new Set()); }}>
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="rules-loading">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="rules-empty">
          {Object.keys(rules).length === 0
            ? 'No rules yet. Change a transaction category and confirm the toast to create one.'
            : 'No rules match your search.'}
        </div>
      ) : (
        <div className="rules-table-wrap">
          <table className="rules-table">
            <thead>
              <tr>
                <th>Merchant key</th>
                <th>Category</th>
                <th>Recurring</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ merchant, category, isRecurring }) => {
                const isEditing = editingKey === merchant;
                return (
                  <tr key={merchant} className={isEditing ? 'rules-row-editing' : ''}>
                    <td className="rules-merchant">{merchant}</td>

                    {isEditing ? (
                      <>
                        <td className="rules-cat-edit">
                          <select
                            className="rules-edit-select"
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="rules-recurring-edit">
                          <label className="rules-recur-check">
                            <input
                              type="checkbox"
                              checked={editForm.isRecurring}
                              onChange={(e) => setEditForm((f) => ({ ...f, isRecurring: e.target.checked }))}
                            />
                            <span>recurring</span>
                          </label>
                        </td>
                        <td className="rules-actions">
                          <div className="rules-edit-btns">
                            <button className="rules-save-btn" onClick={saveEdit}>Save</button>
                            <button className="rules-cancel-btn" onClick={cancelEdit}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="rules-category">{category}</td>
                        <td className="rules-recurring">
                          {isRecurring && <span className="rules-recurring-badge">↻ recurring</span>}
                        </td>
                        <td className="rules-actions">
                          <div className="rules-action-btns">
                            <button
                              className="rules-edit-btn"
                              onClick={() => startEdit(merchant, { category, isRecurring })}
                              title="Edit rule"
                            >
                              Edit
                            </button>
                            <button
                              className="rules-delete-btn"
                              onClick={() => handleDelete(merchant)}
                              title="Delete rule"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
