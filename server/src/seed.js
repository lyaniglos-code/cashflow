import { nanoid } from 'nanoid';

// Generates ~6 months of realistic restaurant transactions ending today.
// The numbers are tuned so a forward 90-day projection trends toward a
// plausible cash shortfall — making the alert + AI demo compelling.
//
// Returns an array of { date, description, amount, category, source }.
// Amounts are signed: positive = income, negative = expense.

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function jitter(base, pct) {
  const delta = base * pct;
  return base + (Math.random() * 2 - 1) * delta;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function generateRestaurantDataset({ months = 6 } = {}) {
  const txns = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setMonth(start.getMonth() - months);

  const push = (date, description, amount, category) => {
    txns.push({
      date: fmt(date),
      description,
      amount: round2(amount),
      category,
      source: 'quickbooks',
    });
  };

  // --- OPENING CASH POSITION ---
  // An owner capital contribution at the start sets a modest cushion. Because
  // it lands outside the trailing-90-day detection window, it only affects the
  // current balance — not the forward projection — so the cushion is finite and
  // gets eroded by the recent revenue slump (producing the shortfall).
  push(start, 'Owner capital contribution', 34000, 'Owner Equity');

  const totalDays = Math.max(1, (today - start) / (1000 * 60 * 60 * 24));

  // Walk day by day.
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0=Sun ... 6=Sat
    const cur = new Date(d);
    const ageDays = (today - cur) / (1000 * 60 * 60 * 24); // 0 today ... ~180 at start

    // Revenue was healthy months ago and has been softening sharply. `revScale`
    // runs from ~1.18 at the start of the history down to ~0.58 today, so the
    // most recent 90 days — which drive the projection — run at a clear loss.
    const revScale = 0.63 + 0.6 * (ageDays / totalDays);

    // --- DAILY POS INCOME (dine-in + takeout) ---
    const isWeekend = day === 5 || day === 6; // Fri/Sat
    const isClosed = day === 1 && Math.random() < 0.15; // occasional Monday closure
    if (!isClosed) {
      let base = isWeekend ? 2800 : day === 0 ? 1750 : 1700; // Sun lower, weekdays modest
      if (day === 1) base = 1100; // Monday slowest
      const pos = jitter(base * revScale, 0.16);
      push(cur, 'Square POS deposit — daily sales', pos, 'POS Income');
    }

    // --- CATERING INCOME (sporadic, larger) — also softening ---
    if (Math.random() < 0.04) {
      const amt = jitter(2300 * revScale, 0.35);
      push(cur, 'Catering event payment', amt, 'Catering Income');
    }

    // --- WEEKLY FOOD SUPPLIER (Tuesdays) ---
    if (day === 2) {
      push(cur, 'Sysco — food supplier order', -jitter(3100, 0.15), 'Food Costs');
    }
    // --- SECOND PRODUCE DELIVERY (Fridays) ---
    if (day === 5) {
      push(cur, 'Local produce & dairy delivery', -jitter(1150, 0.2), 'Food Costs');
    }

    // --- WEEKLY LIQUOR ORDER (Wednesdays) ---
    if (day === 3) {
      push(cur, 'Breakthru Beverage — liquor order', -jitter(1650, 0.22), 'Liquor & Beverage');
    }

    // --- BIWEEKLY PAYROLL (every other Friday) ---
    // Anchor payroll to an even ISO week so it lands consistently biweekly.
    if (day === 5) {
      const weekNum = Math.floor((cur - start) / (1000 * 60 * 60 * 24 * 7));
      if (weekNum % 2 === 0) {
        push(cur, 'Payroll — hourly + salaried staff', -jitter(9800, 0.06), 'Payroll');
      }
    }

    // --- MONTHLY RENT (1st) ---
    if (cur.getDate() === 1) {
      push(cur, 'Commercial lease — monthly rent', -6800, 'Rent');
    }
    // --- MONTHLY UTILITIES (5th) ---
    if (cur.getDate() === 5) {
      push(cur, 'Utilities — electric, gas, water', -jitter(1450, 0.15), 'Utilities');
    }
    // --- MONTHLY INSURANCE (10th) ---
    if (cur.getDate() === 10) {
      push(cur, 'Business liability insurance', -720, 'Insurance');
    }
    // --- MONTHLY POS / MERCHANT FEES (28th) ---
    if (cur.getDate() === 28) {
      push(cur, 'Card processing & POS fees', -jitter(980, 0.2), 'Merchant Fees');
    }
    // --- MONTHLY SOFTWARE / SUBSCRIPTIONS (15th) ---
    if (cur.getDate() === 15) {
      push(cur, 'Software subscriptions (reservations, accounting)', -340, 'Software');
    }
    // --- MONTHLY MARKETING (20th) ---
    if (cur.getDate() === 20) {
      push(cur, 'Local marketing & social ads', -jitter(650, 0.3), 'Marketing');
    }

    // --- OCCASIONAL EQUIPMENT REPAIR ---
    if (Math.random() < 0.012) {
      push(cur, 'Equipment repair — kitchen', -jitter(900, 0.5), 'Repairs & Maintenance');
    }
  }

  // Sort chronologically.
  txns.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return txns;
}

// Standalone seeding: `node src/seed.js --standalone` seeds the demo user.
if (process.argv.includes('--standalone')) {
  const { default: db } = await import('./db.js');
  const { hashPassword } = await import('./auth.js');

  const email = 'demo@bistro.com';
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const id = nanoid();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, business_name, business_type, industry_vertical, shortfall_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, email, hashPassword('demo1234'), 'The Corner Bistro', 'Restaurant', 'Food & Beverage', 2000);
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    console.log('Created demo user demo@bistro.com / demo1234');
  }

  db.prepare('DELETE FROM transactions WHERE user_id = ?').run(user.id);
  const rows = generateRestaurantDataset({ months: 6 });
  const insert = db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMany = db.transaction((items) => {
    for (const t of items) {
      insert.run(nanoid(), user.id, t.date, t.description, t.amount, t.category, t.source);
    }
  });
  insertMany(rows);
  console.log(`Seeded ${rows.length} transactions for ${email}.`);
  process.exit(0);
}
