#!/usr/bin/env node
/**
 * Reads docs/DAILY_CHANGELOG.md, extracts the previous calendar day's section,
 * saves it to daily-summaries/YYYY-MM-DD.txt, and optionally emails it.
 *
 * Usage:
 *   node scripts/send-daily-summary.js           # Save to daily-summaries/ and print
 *   node scripts/send-daily-summary.js --send    # Save and email (requires Gmail in .env)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const changelogPath = join(projectRoot, 'docs', 'DAILY_CHANGELOG.md');
const summariesDir = join(projectRoot, 'daily-summaries');

function parseEnvContent(content) {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const keys = [];
  for (const line of content.split(/\r?\n|\r/)) {
    const trimmed = line.replace(/^\uFEFF/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      keys.push(m[1]);
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      process.env[m[1]] = val;
    }
  }
  return keys;
}

function loadEnvIfPresent() {
  for (const base of [projectRoot, process.cwd()]) {
    const envPath = join(base, '.env');
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, 'utf8');
    parseEnvContent(content);
    return;
  }
}
loadEnvIfPresent();

const RECIPIENT = 'kenzcole96@gmail.com';

function getYesterdayDateString() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractSection(changelog, dateStr) {
  const heading = `## ${dateStr}`;
  const lines = changelog.split(/\r?\n/);
  let inSection = false;
  const body = [];

  for (const line of lines) {
    if (line.startsWith('## ') && line.trim() === heading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) break;
    if (inSection) body.push(line);
  }

  return body.join('\n').trim();
}

async function main() {
  const doSend = process.argv.includes('--send');
  const yesterday = getYesterdayDateString();

  let changelog;
  try {
    changelog = readFileSync(changelogPath, 'utf8');
  } catch (e) {
    console.error('Could not read docs/DAILY_CHANGELOG.md:', e.message);
    process.exit(1);
  }

  const summary = extractSection(changelog, yesterday);
  const subject = `PinHigh daily summary — ${yesterday}`;
  const text = summary || `(No entries for ${yesterday})`;

  mkdirSync(summariesDir, { recursive: true });
  const outPath = join(summariesDir, `${yesterday}.txt`);
  writeFileSync(outPath, `PinHigh daily summary — ${yesterday}\n\n${text}\n`, 'utf8');

  console.log(`Summary for ${yesterday}:\n`);
  console.log(text);
  console.log(`\nSaved to ${outPath}`);

  if (doSend) {
    let nodemailer;
    try {
      nodemailer = (await import('nodemailer')).default;
    } catch {
      console.error('\nTo send email, install nodemailer: npm install nodemailer');
      process.exit(1);
    }

    const user = process.env.SMTP_USER ?? process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      const missing = [];
      if (!user) missing.push('GMAIL_USER (or SMTP_USER)');
      if (!pass) missing.push('GMAIL_APP_PASSWORD (or SMTP_PASS)');
      console.error('\nSet SMTP_USER and SMTP_PASS (or GMAIL_USER and GMAIL_APP_PASSWORD) to send email.');
      console.error('  Missing in .env:', missing.join(', '));
      const envPath = join(projectRoot, '.env');
      console.error('  .env path:', envPath);
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
        const keysForReport = content.split(/\r?\n|\r/).map((l) => l.replace(/^\uFEFF/, '').trim()).filter((l) => l && !l.startsWith('#')).map((l) => (l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/) || [])[1]).filter(Boolean);
        console.error('  .env exists. Keys found:', keysForReport.length ? keysForReport.join(', ') : 'none');
        console.error('  Use exactly: GMAIL_USER=... and GMAIL_APP_PASSWORD=... (no spaces around =). Save .env (Cmd+S) and run again.');
        console.error('  See .env.example and https://myaccount.google.com/apppasswords');
      } else {
        console.error('  No .env file at', envPath);
      }
      process.exit(1);
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: user,
        to: RECIPIENT,
        subject,
        text,
      });
      console.log('\nEmail sent to ' + RECIPIENT);
    } catch (e) {
      console.error('\nFailed to send email:', e.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
