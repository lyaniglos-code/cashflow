import { useState, useRef, useEffect } from 'react';
import { api } from '../api.js';
import { money } from './format.js';

const SUGGESTIONS = [
  'Why am I projected to run short on cash?',
  'Build a plan to avoid the shortfall',
  'How can I extend my runway by 30 days?',
];

function ProposedPlan({ plan, onSave, saving, saved }) {
  const imp = plan.impact || {};
  const delta = imp.delta90 ?? 0;
  const scenSf = imp.scenario?.shortfall;
  return (
    <div className="mt-2 rounded-xl border border-teal/30 bg-teal/[0.06] p-3">
      <div className="flex items-center gap-2">
        <span className="chip bg-teal/15 text-teal-soft">Proposed plan</span>
        <span className="text-sm font-semibold text-white">{plan.title}</span>
      </div>
      {plan.rationale && <p className="mt-1 text-xs text-slate-300">{plan.rationale}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={`tnum font-semibold ${delta >= 0 ? 'text-teal' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}
          {money(delta)} <span className="font-normal text-slate-400">over 90 days</span>
        </span>
        <span className="tnum text-slate-400">ends {money(imp.scenario?.endBalance ?? 0)}</span>
        <span className="text-slate-400">{scenSf ? `shortfall in ${scenSf.daysUntil}d` : 'no shortfall'}</span>
      </div>
      <button className="btn-primary btn-sm mt-3 w-full" onClick={() => onSave(plan)} disabled={saving || saved}>
        {saved ? '✓ Saved to Action Plans' : saving ? 'Saving…' : 'Save to Action Plans'}
      </button>
    </div>
  );
}

export default function PlannerChat({ onPlanSaved }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [savingIdx, setSavingIdx] = useState(null);
  const [savedIdx, setSavedIdx] = useState(new Set());
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await api.chat(next.map((m) => ({ role: m.role, content: m.content })));
      if (res.disabled) setDisabled(true);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, plan: res.plan || null }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(plan, idx) {
    setSavingIdx(idx);
    try {
      await api.savePlan({ title: plan.title, rationale: plan.rationale, adjustments: plan.adjustments });
      setSavedIdx((s) => new Set(s).add(idx));
      onPlanSaved?.();
    } finally {
      setSavingIdx(null);
    }
  }

  return (
    <div className="card flex flex-col p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal/12 text-teal ring-1 ring-teal/25 text-xs">
          ✦
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Planning Assistant</h3>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Clarify a recommendation, or ask for a plan — proposed plans are scored by the real forecast engine.
      </p>

      <div ref={scrollRef} className="mb-3 max-h-72 min-h-[3rem] flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="btn-ghost btn-sm">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-teal/15 px-3 py-2 text-sm text-slate-100">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start">
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-slate-200">
                {m.content}
              </div>
              {m.plan && (
                <ProposedPlan
                  plan={m.plan}
                  onSave={(p) => savePlan(p, i)}
                  saving={savingIdx === i}
                  saved={savedIdx.has(i)}
                />
              )}
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-1.5 px-1 text-slate-400">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal" />
          </div>
        )}
      </div>

      {disabled && (
        <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Add an <code className="text-amber-200">ANTHROPIC_API_KEY</code> to chat with the assistant. You can still
          build & save plans from the Scenario Planner.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <input
          className="input"
          placeholder="Ask about your cash flow…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn-primary px-3" disabled={busy || !input.trim()} aria-label="Send">
          ➤
        </button>
      </form>
    </div>
  );
}
