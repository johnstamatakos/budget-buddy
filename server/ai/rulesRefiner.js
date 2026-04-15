import { anthropic } from './claudeClient.js';

const SYSTEM_PROMPT = `You analyze merchant categorization rules for a personal finance app.

HOW MATCHING WORKS:
- Rules use prefix matching with word boundaries
- Rule key "foo" matches transactions whose normalized description equals "foo" OR starts with "foo " (space after)
- "starbucks" matches: "starbucks", "starbucks #1234", "starbucks coffee shop 5th ave"
- "starbucks coffee" matches: "starbucks coffee", "starbucks coffee shop" — but NOT "starbucks latte"
- "amazon.com" is NOT matched by "amazon" (dot is not a word boundary)
- When two rules both match, the LONGER (more specific) key wins

YOUR TASK:
Given a list of rules as { key, category, isRecurring }, find:

1. REDUNDANT: Rule A is redundant if there exists rule B where:
   - B's key is a true prefix of A's key (A starts with B's key followed by a space)
   - A and B have the same category
   → Deleting A is safe — B already catches everything A would catch

2. CONFLICTS: Rule A and B share a prefix relationship but have DIFFERENT categories
   → The more specific one currently overrides the general one; flag for user awareness

3. SEMANTIC DUPLICATES: Rules that refer to the same merchant but with different key forms
   (e.g., "walmart" and "wal-mart", "mcdonalds" and "mcdonald's")
   → These may need consolidation (user decides)

Return only valid JSON, no explanation outside it:
{
  "redundant": [
    { "key": "starbucks coffee shop", "coveredBy": "starbucks", "category": "Restaurants", "reason": "..." }
  ],
  "conflicts": [
    { "specificKey": "amazon prime", "generalKey": "amazon", "specificCategory": "Subscriptions", "generalCategory": "Shopping", "reason": "..." }
  ],
  "semanticDuplicates": [
    { "keys": ["walmart", "wal-mart"], "category": "Shopping", "reason": "..." }
  ],
  "summary": "One sentence summary of findings"
}

Return empty arrays if nothing found. Be conservative — only flag clear cases.`;

export async function refineRules(rules) {
  const entries = Object.entries(rules).map(([key, value]) => ({
    key,
    category: typeof value === 'string' ? value : value.category,
    isRecurring: typeof value === 'string' ? false : Boolean(value.isRecurring),
  }));

  if (entries.length < 2) {
    return {
      redundant: [],
      conflicts: [],
      semanticDuplicates: [],
      summary: 'Not enough rules to analyze.',
    };
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(entries) }],
  });

  let text = '';
  for (const block of message.content) {
    if (block.type === 'text') { text = block.text; break; }
  }

  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(json);
}
