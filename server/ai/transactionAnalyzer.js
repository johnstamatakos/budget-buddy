import { anthropic } from './claudeClient.js';

const SYSTEM_PROMPT = `You are a financial transaction analyzer. Given raw bank statement or spreadsheet data, extract every transaction and return them as a JSON object.

Rules:
- Deposits/credits/income are POSITIVE amounts; expenses/debits/charges are NEGATIVE
- Categorize each transaction into exactly one of these categories:
  Auto, Home, Utilities, Credit Cards, Student Loans, Subscriptions, Shopping, Groceries, Restaurants, Other
- Mark isRecurring: true for charges that repeat on a fixed schedule (rent, Netflix, Spotify, gym, loan payments, insurance, phone bill, internet, utilities, etc.)
- Mark isDeposit: true when the amount is positive (paycheck, refund, transfer in, interest)

Category guide:
- Auto: gas stations, car payments, auto insurance, parking, car repair, Uber/Lyft (as a passenger)
- Home: rent, mortgage, home insurance, furniture, home repair, household items
- Utilities: electric, gas, water, internet, phone bill, cable
- Credit Cards: credit card payments (not purchases)
- Student Loans: student loan payments
- Subscriptions: Netflix, Spotify, Hulu, Disney+, gym memberships, software, magazines, meal kits
- Shopping: Amazon, clothing, electronics, general retail, department stores
- Groceries: supermarkets, grocery stores (Whole Foods, Trader Joe's, Costco, etc.)
- Restaurants: restaurants, cafes, fast food, bars, food delivery (DoorDash, Uber Eats, Grubhub)
- Other: anything else that does not fit the above

You MUST return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "merchant or transaction name",
      "amount": -12.34,
      "category": "Restaurants",
      "isRecurring": false,
      "isDeposit": false
    }
  ]
}`;

export async function analyzeTransactions(rawData) {
  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Analyze the following financial data and extract all transactions:\n\n${rawData}`,
      },
    ],
  });

  const message = await stream.finalMessage();

  // Extract text from response
  let jsonText = '';
  for (const block of message.content) {
    if (block.type === 'text') {
      jsonText = block.text;
      break;
    }
  }

  // Strip markdown code fences if present
  jsonText = jsonText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Find the JSON object bounds
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    jsonText = jsonText.slice(start, end + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Failed to parse Claude response as JSON. Please try again.');
  }

  if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
    throw new Error('Unexpected response format from Claude. Please try again.');
  }

  return parsed.transactions;
}
