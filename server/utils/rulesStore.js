import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Stored at <repo-root>/data/rules.json — covered by the data/ gitignore
const RULES_PATH = fileURLToPath(new URL('../../data/rules.json', import.meta.url));

// All US state + territory abbreviations — used to detect trailing location data
const STATE_ABBR_RE =
  /\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|VI|GU)\s*$/i;

/**
 * Extracts a stable merchant key from a raw transaction description.
 *
 * Strips bank-appended noise:
 *   "CHEWY.COM PLANTATION FL Transaction Date : 01/12/2026" → "chewy.com"
 *   "SUNOCO 0338384100"                                      → "sunoco"
 *   "GOOGLE *Google Mountain View CA Transaction Date : 01/" → "google *google"
 */
export function normalizeMerchantKey(source) {
  let s = (source || '').trim();

  // 1. Strip "Transaction Date : ..." (with optional leading dash / en-dash / space)
  s = s.replace(/\s*[-–]?\s*Transaction Date\s*:.*/i, '');

  // 2. Strip trailing US state abbreviation
  if (STATE_ABBR_RE.test(s)) {
    s = s.replace(STATE_ABBR_RE, '');
    // Strip any immediately-preceding all-alpha "city" words (1–3 words)
    // Only remove words that are purely alphabetic — preserves brand chars like ., *, #
    s = s.replace(/(\s+[A-Za-z]{2,}){1,3}\s*$/, (match) => {
      const words = match.trim().split(/\s+/);
      return words.every((w) => /^[A-Za-z]+$/.test(w)) ? '' : match;
    });
  }

  // 3. Strip trailing store / reference codes (digit-heavy suffixes)
  s = s.replace(/[\s#]+\d[\d\s\-#./]*$/, '');

  // 4. Lowercase and normalise whitespace
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function loadRules() {
  try {
    if (!existsSync(RULES_PATH)) return {};
    const raw = JSON.parse(await readFile(RULES_PATH, 'utf8'));
    // Migrate old format (string value) → new format { category, isRecurring }
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
      out[key] = typeof value === 'string'
        ? { category: value, isRecurring: false }
        : value;
    }
    return out;
  } catch {
    return {};
  }
}

async function saveRules(rules) {
  await writeFile(RULES_PATH, JSON.stringify(rules, null, 2));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getRules() {
  return loadRules();
}

export async function setRule(merchant, category, isRecurring = false) {
  const key = normalizeMerchantKey(merchant);
  if (!key) return;
  const rules = await loadRules();
  const prev = rules[key];
  console.log(
    prev === undefined
      ? `[rules] New rule: "${key}" → ${category} recurring:${isRecurring}`
      : `[rules] Updated: "${key}" ${prev.category}→${category} recurring:${prev.isRecurring}→${isRecurring}`
  );
  rules[key] = { category, isRecurring: Boolean(isRecurring) };
  await saveRules(rules);
}

export async function deleteRule(merchantOrKey) {
  const key = normalizeMerchantKey(merchantOrKey);
  const rules = await loadRules();
  if (rules[key] === undefined) return false;
  console.log(`[rules] Rule deleted: "${key}"`);
  delete rules[key];
  await saveRules(rules);
  return true;
}

/**
 * Apply saved rules to a list of transactions.
 * Uses prefix matching so "sunoco" matches "sunoco 0338384100".
 * Longest matching key wins (more specific beats generic).
 */
export async function applyRules(transactions) {
  const rules = await loadRules();
  const ruleKeys = Object.keys(rules);
  if (ruleKeys.length === 0) return transactions;

  return transactions.map((t) => {
    if (t.isDeposit) return { ...t, ruleApplied: false };

    const norm = normalizeMerchantKey(t.description);

    // Find longest matching rule key (prefix match with word-boundary check)
    let bestKey = null;
    let bestLen = 0;
    for (const key of ruleKeys) {
      if (key.length <= bestLen) continue;
      if (
        norm === key ||
        (norm.startsWith(key) && norm[key.length] === ' ')
      ) {
        bestKey = key;
        bestLen = key.length;
      }
    }

    if (bestKey) {
      const rule = rules[bestKey];
      console.log(`[rules] Applied "${bestKey}" → ${rule.category} on: "${t.description}"`);
      return {
        ...t,
        category: rule.category,
        isRecurring: rule.isRecurring,
        ruleApplied: true,
      };
    }
    return { ...t, ruleApplied: false };
  });
}

// Legacy no-op — no longer called from any save path
export async function learnFromTransactions() {}
