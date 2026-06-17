import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Twilio SMS wrapper.
//
// PRODUCTION: set these in .env with your live credentials from
// https://console.twilio.com — Account SID (starts "AC..."), Auth Token, and a
// Messaging-capable phone number you own (E.164, e.g. +14155551234):
//     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
//
// TESTING: Twilio provides *test credentials* (a separate Test Account SID +
// Test Auth Token on the same console page). With those, use Twilio's magic
// numbers — from/to "+15005550006" is a valid testable number — and no real SMS
// is sent or billed. Just paste the test SID/token/number into .env.
//
// LOCAL DEV (no credentials at all): if the env vars are missing we run in
// SIMULATION mode — messages are logged to the server console and recorded in
// notification_log with status "simulated", so the entire alert pipeline is
// fully exercisable without any Twilio account.
// ---------------------------------------------------------------------------

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (SID && TOKEN && SID.startsWith('AC')) {
  client = twilio(SID, TOKEN);
}

export function twilioEnabled() {
  return Boolean(client && FROM);
}

// Send an SMS. Returns { sid, simulated }. Never throws on send failure — the
// caller logs the outcome; a failed SMS should not crash a cron run.
export async function sendSms(to, body) {
  if (!to) return { simulated: true, error: 'no phone number' };
  if (!twilioEnabled()) {
    console.log(`\n[SMS simulated] → ${to}\n   ${body}\n`);
    return { simulated: true };
  }
  try {
    const msg = await client.messages.create({ to, from: FROM, body });
    return { sid: msg.sid, simulated: false };
  } catch (err) {
    console.error(`[SMS error] → ${to}: ${err.message}`);
    return { simulated: false, error: err.message };
  }
}
