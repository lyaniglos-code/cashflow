import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export function aiEnabled() {
  return Boolean(client);
}

function money(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

// Build a compact text summary of the financial context to pass to Claude.
function buildContext({ profile, balance, deltas, breakdown, patterns, shortfall, kpis }) {
  const lines = [];
  lines.push(
    `Business: ${profile.business_name || 'Unnamed'} (${profile.business_type || 'unknown type'}, ${profile.industry_vertical || 'n/a'})`
  );
  lines.push(`Current cash balance: ${money(balance)}`);
  if (kpis) {
    const burn =
      kpis.burnRate >= 0 ? `net positive ${money(kpis.burnRate)}/mo` : `burning ${money(Math.abs(kpis.burnRate))}/mo`;
    const runway =
      kpis.runway?.status === 'growing'
        ? 'growing (no runway concern)'
        : kpis.runway?.days != null
          ? `${kpis.runway.days} days`
          : 'healthy';
    lines.push(`KPIs — Burn rate: ${burn}; Trailing 30-day revenue: ${money(kpis.revenue)}; Runway: ${runway}`);
  }
  lines.push(
    `Projected net change — 30 days: ${money(deltas.d30.net)} (ending ${money(deltas.d30.endBalance)}), 60 days: ${money(deltas.d60.net)} (ending ${money(deltas.d60.endBalance)}), 90 days: ${money(deltas.d90.net)} (ending ${money(deltas.d90.endBalance)})`
  );

  const income = patterns.filter((p) => p.type === 'income');
  const expense = patterns.filter((p) => p.type === 'expense');
  if (income.length) {
    lines.push('Recurring income:');
    for (const p of income) lines.push(`  - ${p.label} (${p.cadence}, avg ${money(p.avgAmount)})`);
  }
  if (expense.length) {
    lines.push('Recurring expenses:');
    for (const p of expense) lines.push(`  - ${p.label} (${p.cadence}, avg ${money(p.avgAmount)})`);
  }
  if (breakdown?.length) {
    lines.push('Top categories (last 90 days):');
    for (const c of breakdown.slice(0, 6)) {
      lines.push(`  - ${c.category}: income ${money(c.income)}, expense ${money(c.expense)}`);
    }
  }
  if (shortfall) {
    lines.push(
      `PROJECTED SHORTFALL: balance first dips below the ${money(shortfall.threshold)} threshold on ${shortfall.date} (in ${shortfall.daysUntil} days) and continues falling to a low of ${money(shortfall.lowestBalance ?? shortfall.projectedBalance)} on ${shortfall.lowestDate ?? shortfall.date} — a worst-case deficit of ${money(shortfall.deficitAmount)} below the threshold.`
    );
  } else {
    lines.push('No projected shortfall within the next 90 days.');
  }
  return lines.join('\n');
}

async function callClaude(systemPrompt, userPrompt, maxTokens = 1024) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// ---------- 1. Cash flow narrative summary ----------
export async function generateNarrative(ctx) {
  const context = buildContext(ctx);
  if (!client) return { text: fallbackNarrative(ctx), source: 'template' };
  try {
    const text = await callClaude(
      'You are a friendly small-business CFO advisor. Write a concise, plain-English cash flow summary (3-5 sentences) for a non-financial business owner. Be direct, specific with numbers, and reassuring but honest. No markdown headers, no bullet points — just a short paragraph.',
      `Here is the business's cash flow data:\n\n${context}\n\nWrite the cash flow summary.`,
      600
    );
    return { text, source: 'claude' };
  } catch (err) {
    return { text: fallbackNarrative(ctx), source: 'template', error: String(err.message || err) };
  }
}

// ---------- 2. Three action recommendations ----------
export async function generateRecommendations(ctx) {
  const context = buildContext(ctx);
  if (!client) return { items: fallbackRecommendations(ctx), source: 'template' };
  try {
    const text = await callClaude(
      "You are a small-business cash flow advisor. Based on the data, produce EXACTLY 3 specific, actionable recommendations. Each must be one sentence, concrete, and reference the business's actual numbers where useful. Return ONLY a numbered list (1., 2., 3.) with no preamble and no extra commentary.",
      `Here is the business's cash flow data:\n\n${context}\n\nGive 3 specific action recommendations.`,
      600
    );
    const items = parseNumberedList(text).slice(0, 3);
    if (items.length < 1) return { items: fallbackRecommendations(ctx), source: 'template' };
    return { items, source: 'claude' };
  } catch (err) {
    return { items: fallbackRecommendations(ctx), source: 'template', error: String(err.message || err) };
  }
}

// ---------- 3. Shortfall explanation ----------
export async function explainShortfall(ctx) {
  if (!ctx.shortfall) return { text: '', source: 'none' };
  const context = buildContext(ctx);
  if (!client) return { text: fallbackShortfall(ctx), source: 'template' };
  try {
    const text = await callClaude(
      'You are a small-business cash flow advisor. Explain the projected cash shortfall in 2-3 plain-English sentences: why it is happening (which expenses outpace income) and the single most important thing to do about it. No markdown, no lists — just a short, urgent-but-calm paragraph.',
      `Here is the business's cash flow data:\n\n${context}\n\nExplain the shortfall and the top corrective action.`,
      500
    );
    return { text, source: 'claude' };
  } catch (err) {
    return { text: fallbackShortfall(ctx), source: 'template', error: String(err.message || err) };
  }
}

// ---------- Short NL snippets for SMS (kept tiny to fit 160 chars) ----------
// kind: 'shortfall_cause' -> ≤6-word phrase naming the main driver of the
//       shortfall; 'weekly_outlook' -> a 2-4 word health phrase.
export async function smsBlurb(kind, ctx) {
  if (!client) return fallbackBlurb(kind, ctx);
  try {
    let system;
    let prompt;
    if (kind === 'shortfall_cause') {
      system =
        'You write ultra-short SMS fragments. Given a small business\'s cash data, reply with the SINGLE main cause of its projected cash shortfall as a fragment of AT MOST 6 words (e.g. "payroll outpacing slowing sales", "rent + food costs vs low revenue"). No punctuation at the end, no quotes, no preamble.';
      prompt = `${buildContext(ctx)}\n\nMain cause of the shortfall (≤6 words):`;
    } else {
      system =
        'You write ultra-short SMS fragments. Reply with a 2-4 word health phrase for this business\'s 30-day cash outlook (e.g. "healthy and stable", "tight but managing", "critical — act now"). No quotes, no preamble.';
      prompt = `${buildContext(ctx)}\n\n30-day outlook (2-4 words):`;
    }
    const text = await callClaude(system, prompt, 40);
    return cleanBlurb(text) || fallbackBlurb(kind, ctx);
  } catch {
    return fallbackBlurb(kind, ctx);
  }
}

function cleanBlurb(text) {
  return String(text || '')
    .replace(/^["'\s]+|["'.\s]+$/g, '')
    .split('\n')[0]
    .slice(0, 48)
    .trim();
}

function fallbackBlurb(kind, ctx) {
  if (kind === 'weekly_outlook') {
    if (ctx.shortfall && ctx.shortfall.daysUntil <= 30) return 'critical — act now';
    if (ctx.shortfall) return 'tight but managing';
    return ctx.deltas?.d30?.net >= 0 ? 'healthy and stable' : 'tightening';
  }
  // shortfall_cause: name the biggest recurring expense vs. income trend.
  const topExpense = [...(ctx.breakdown || [])].sort((a, b) => b.expense - a.expense)[0];
  return topExpense ? `${topExpense.category.toLowerCase()} outpacing sales` : 'expenses outpacing income';
}

function parseNumberedList(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+[.)]/.test(l))
    .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

// ---------- Planning chatbot (tool-use, engine-grounded) ----------
// Conversational assistant whose only job is to clarify the recommendations and
// build cash-flow plans. When it proposes a plan it MUST use the `propose_plan`
// tool; the server then runs those adjustments through the real forecast engine
// (`runImpact`) and feeds the true numbers back, so the model speaks to grounded
// figures rather than guesses.
const PLAN_TOOL = {
  name: 'propose_plan',
  description:
    "Propose a concrete cash-flow plan and get its REAL projected impact computed by the forecasting engine. Call this whenever the user asks how to change, improve, or avoid a problem with their cash flow. Returns the engine's baseline-vs-scenario numbers.",
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short name for the plan, e.g. "Trim costs + add catering"' },
      rationale: { type: 'string', description: 'One or two sentences on why this plan helps.' },
      adjustments: {
        type: 'array',
        description: 'The concrete changes to model.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['hire', 'contract', 'recurring', 'oneoff'] },
            label: { type: 'string', description: 'Human label for this change.' },
            monthlyAmount: { type: 'number', description: 'For type "hire": monthly salary cost (positive number).' },
            amount: {
              type: 'number',
              description: 'For contract/recurring/oneoff: dollar amount. Positive = money in, negative = money out.',
            },
            cadenceDays: {
              type: 'number',
              description: 'For type "recurring": days between occurrences (e.g. 7, 30).',
            },
            date: { type: 'string', description: 'For contract/oneoff: ISO date YYYY-MM-DD.' },
          },
          required: ['type'],
        },
      },
    },
    required: ['title', 'adjustments'],
  },
};

function impactSummary(impact) {
  const base = impact.baseline;
  const scen = impact.scenario;
  return {
    baseline_90day_end_balance: base.endBalance,
    scenario_90day_end_balance: scen.endBalance,
    improvement_vs_baseline: impact.delta90,
    baseline_shortfall: base.shortfall
      ? { in_days: base.shortfall.daysUntil, worst_deficit: base.shortfall.deficitAmount }
      : null,
    scenario_shortfall: scen.shortfall
      ? { in_days: scen.shortfall.daysUntil, worst_deficit: scen.shortfall.deficitAmount }
      : 'no shortfall within 90 days',
    threshold: impact.threshold,
  };
}

export async function chatPlanner(messages, ctx, runImpact) {
  if (!client) {
    return {
      reply:
        'The AI planning assistant needs an Anthropic API key. Add ANTHROPIC_API_KEY to your .env and restart to chat about your recommendations and auto-build cash-flow plans. In the meantime, you can build and save plans manually from the Scenario Planner.',
      plan: null,
      disabled: true,
    };
  }

  const recs = (ctx.recommendations || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
  const system = `You are ForecastOS's planning assistant for a small business owner. Your SOLE purpose is to (a) clarify the app's cash-flow recommendations in plain English and (b) help build concrete, statistically accurate plans to improve cash flow. Stay strictly on cash flow / financial planning for THIS business; politely decline unrelated requests.

When the user wants to change, improve, or avoid a problem with their cash flow, you MUST call the propose_plan tool so the real forecasting engine computes the impact — never estimate the numbers yourself. After the tool returns, explain the result in 2-4 plain sentences using the engine's figures. Be concise, warm, and practical. No markdown headers.

Current financial context:
${buildContext(ctx)}

The app's current recommendations:
${recs || '(none yet)'}`;

  const convo = messages
    .filter((m) => m && m.content)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));

  let plan = null;

  try {
    for (let iter = 0; iter < 4; iter++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [PLAN_TOOL],
        messages: convo,
      });

      if (resp.stop_reason === 'tool_use') {
        convo.push({ role: 'assistant', content: resp.content });
        const toolResults = [];
        for (const block of resp.content) {
          if (block.type === 'tool_use' && block.name === 'propose_plan') {
            const adjustments = Array.isArray(block.input.adjustments) ? block.input.adjustments : [];
            const impact = runImpact(adjustments);
            plan = {
              title: block.input.title || 'Cash-flow plan',
              rationale: block.input.rationale || '',
              adjustments,
              impact,
            };
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(impactSummary(impact)),
            });
          }
        }
        convo.push({ role: 'user', content: toolResults });
        continue; // let the model summarize the grounded numbers
      }

      const reply = resp.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { reply, plan };
    }
    return { reply: 'I built the plan below — review its projected impact.', plan };
  } catch (err) {
    return { reply: `Sorry, I hit an error talking to the planner: ${err.message || err}`, plan, error: true };
  }
}

// ---------------- Deterministic fallbacks (no API key required) ----------------

function fallbackNarrative(ctx) {
  const { profile, balance, deltas, shortfall } = ctx;
  const name = profile.business_name || 'Your business';
  const trend = deltas.d90.net >= 0 ? 'growing' : 'declining';
  let s = `${name} currently holds ${money(balance)} in cash. Based on the last 90 days of activity, the balance is projected to be ${trend}, with a net change of about ${money(deltas.d90.net)} over the next 90 days — ending near ${money(deltas.d90.endBalance)}. `;
  if (shortfall) {
    s += `However, cash is expected to dip below your ${money(shortfall.threshold)} safety threshold around ${shortfall.date} (in ${shortfall.daysUntil} days), so near-term planning is important.`;
  } else {
    s += `No cash shortfall is projected within the window, which gives you room to plan investments or build a reserve.`;
  }
  return s;
}

function fallbackRecommendations(ctx) {
  const { deltas, breakdown, shortfall } = ctx;
  const topExpense = [...(breakdown || [])].sort((a, b) => b.expense - a.expense)[0];
  const items = [];
  if (shortfall) {
    items.push(
      `Build a cash buffer now: aim to set aside or secure financing of at least ${money(shortfall.deficitAmount)} before ${shortfall.date} to cover the projected shortfall.`
    );
  } else {
    items.push(
      `Maintain momentum: with a projected 90-day net of ${money(deltas.d90.net)}, move a portion into a reserve account to protect against slow weeks.`
    );
  }
  if (topExpense) {
    items.push(
      `Review your largest cost center, ${topExpense.category} (~${money(topExpense.expense)} over 90 days), and negotiate terms or trim 5-10% to improve margins.`
    );
  } else {
    items.push(`Track your largest expense categories weekly so cost creep is caught early.`);
  }
  items.push(
    `Smooth incoming cash by encouraging deposits on catering/large orders and tightening the gap between sales and bank deposits.`
  );
  return items.slice(0, 3);
}

function fallbackShortfall(ctx) {
  const { shortfall } = ctx;
  if (!shortfall) return '';
  return `Cash is projected to drop below your ${money(shortfall.threshold)} threshold on ${shortfall.date} (in ${shortfall.daysUntil} days) and keep falling to a low of ${money(shortfall.lowestBalance ?? shortfall.projectedBalance)} — a worst-case gap of about ${money(shortfall.deficitAmount)} — because recurring fixed costs like payroll, rent, and supplier orders are outpacing softening daily sales. The most important step is to line up a buffer (reserve cash or a short-term credit line) now and drive a quick revenue lift, such as a catering push or promotion, before that date.`;
}
