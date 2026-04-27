import { anthropic } from './claudeClient.js';

const SYSTEM_PROMPT = `You are a bank transaction merchant grouper. You will receive a JSON array of unique transaction description strings from a personal finance app.

Your job: identify descriptions that refer to the SAME real-world merchant or payee, even if worded differently. Common causes of variation:
- Bank adds "Automated Payment", "REC:", "DEBIT", or the account holder's name
- One source uses a formal name, another uses a short name or abbreviation
- Store/reference codes are present in one but not the other

Return a JSON array of clusters. Each cluster must have 2 or more descriptions. Only include descriptions that truly belong together — if a description has no match, omit it entirely.

Return ONLY valid JSON — no markdown, no explanation:
[{"descriptions":["MIDWEST LOAN MTG PMT REC: JOHN STAMATAKOS","Automated Payment MIDWEST LOAN MTG PMT"]},...]`;

/**
 * Use Claude to cluster similar merchant descriptions.
 * Returns only clusters with 2+ descriptions (singletons omitted).
 * @param {string[]} descriptions - Unique description strings
 * @returns {Promise<Array<{descriptions: string[]}>>}
 */
export async function groupMerchants(descriptions) {
  if (descriptions.length < 2) return [];

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(descriptions) }],
  });

  let jsonText = '';
  for (const block of message.content) {
    if (block.type === 'text') { jsonText = block.text; break; }
  }

  jsonText = jsonText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const s = jsonText.indexOf('[');
  const e = jsonText.lastIndexOf(']');
  if (s !== -1 && e !== -1) jsonText = jsonText.slice(s, e + 1);

  let clusters;
  try {
    clusters = JSON.parse(jsonText);
  } catch {
    console.error('[merchantGrouper] Failed to parse Claude response:', jsonText.slice(0, 300));
    return [];
  }

  if (!Array.isArray(clusters)) return [];

  // Filter to valid clusters with 2+ descriptions
  return clusters.filter(
    (c) => c && Array.isArray(c.descriptions) && c.descriptions.length >= 2
  );
}
