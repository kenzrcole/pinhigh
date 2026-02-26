# PinHigh scripts

## Daily summary (9 AM PST)

The **previous day’s work** is summarized from `docs/DAILY_CHANGELOG.md`, **saved to a folder**, and optionally emailed.

### 1. Log your changes

- Edit **`docs/DAILY_CHANGELOG.md`**.
- Add a section `## YYYY-MM-DD` for each day you work.
- List changes as bullets (one line per change is enough).

### 2. Run the summary (saves to folder)

From the project root:

```bash
npm run daily-summary
# or
node scripts/send-daily-summary.js
```

This writes yesterday’s changelog section to **`daily-summaries/YYYY-MM-DD.txt`** (e.g. `daily-summaries/2026-02-10.txt`) and prints it to the terminal. The folder is created automatically; `daily-summaries/` is in `.gitignore` so summaries stay local.

### 3. Send the summary by email

**One-time setup**

1. Install nodemailer (only needed for sending):
   ```bash
   npm install nodemailer
   ```
2. Create a `.env` in the project root (do not commit it). For Gmail with an App Password:
   ```env
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   ```
   Or use SMTP:
   ```env
   SMTP_USER=your.email@example.com
   SMTP_PASS=your-password
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   ```
3. Load env when running (e.g. `source .env` or use `dotenv`). The script reads `process.env`, so you can also export the vars in your shell.

**Send the previous day’s summary**

```bash
npm run daily-summary:send
# or
node scripts/send-daily-summary.js --send
```

### 4. Schedule for 9 AM PST every day

**Option A – cron (macOS/Linux)**

Run at 9 AM Pacific:

```bash
crontab -e
```

Add (replace `PATH_TO_PROJECT` with your project path):

```
0 9 * * * TZ=America/Los_Angeles cd /PATH_TO_PROJECT && node scripts/send-daily-summary.js --send
```

If your system doesn’t support `TZ=` in crontab, set the timezone in the shell (e.g. run in a wrapper that exports `TZ=America/Los_Angeles`) or set the cron time in your server’s local time (e.g. 9 AM if the server is already in PST).

**Option B – macOS launchd**

Create `~/Library/LaunchAgents/com.pinhigh.daily-summary.plist` (adjust paths and env):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pinhigh.daily-summary</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>/PATH_TO_PROJECT/scripts/send-daily-summary.js</string>
    <string>--send</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/PATH_TO_PROJECT</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
    <key>Timezone</key>
    <string>America/Los_Angeles</string>
  </dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>GMAIL_USER</key>
    <string>your.email@gmail.com</string>
    <key>GMAIL_APP_PASSWORD</key>
    <string>your-app-password</string>
  </dict>
</dict>
</plist>
```

Then:

```bash
launchctl load ~/Library/LaunchAgents/com.pinhigh.daily-summary.plist
```

**Note:** launchd’s `Timezone` is supported on macOS 13+. On older macOS, the job runs at 9:00 in the system timezone; set the system to Pacific or use cron with `TZ=America/Los_Angeles`.

---

### macOS: copy-paste setup (9 AM PST)

1. **One-time:** In the project root, create `.env` with your Gmail credentials (see “Send the summary by email” above). The script loads `.env` when it runs, so you don’t put secrets in the plist.

2. **Install nodemailer** (needed for sending):
   ```bash
   cd /path/to/project && npm install nodemailer
   ```

3. **Copy the plist template and set your project path:**
   ```bash
   cd /path/to/project
   PROJECT_PATH=$(pwd)
   sed "s|REPLACE_WITH_FULL_PATH_TO_PROJECT|$PROJECT_PATH|g" scripts/com.pinhigh.daily-summary.plist.template > ~/Library/LaunchAgents/com.pinhigh.daily-summary.plist
   ```

4. **Load the job** (runs every day at 9 AM PST):
   ```bash
   launchctl load ~/Library/LaunchAgents/com.pinhigh.daily-summary.plist
   ```

5. **Check it’s loaded:**
   ```bash
   launchctl list | grep pinhigh
   ```
   You should see `com.pinhigh.daily-summary`.

**To stop the daily email:** `launchctl unload ~/Library/LaunchAgents/com.pinhigh.daily-summary.plist`

**To run the summary once now (test):** `npm run daily-summary:send`

---

### Summary

| Action              | Command                                      |
|---------------------|----------------------------------------------|
| Save + print yesterday | `npm run daily-summary`                  |
| Save + email yesterday | `npm run daily-summary:send` (needs .env) |

Recipient is **kenzcole96@gmail.com**. The script uses the **previous calendar day** (in the server’s local time when run) to pick the changelog section, so running it at 9 AM PST sends the prior day’s log.

---

## Weekly report (Mondays 9:00 AM)

The **weekly report** runs AI competitor simulations for **0 HCP, 5 HCP, 10 HCP, 20 HCP, EW 2K, and LPGA**, then generates:

- A **high-level overview** from **docs/WEEKLY_OVERVIEW.md** (add a section for the week and paste what was created/built/updated/tested — e.g. from Cursor Agent or notes). If that file has no section for the week, the report uses **recently modified files** (last 7 days under src/, scripts/, docs/)
- **Simulation count**, **per-profile stats** (fairways hit %, GIR %, putts/round, up & down %), and **trends/anomalies**
- **One PDF per profile** with **map images**: each hole shown as a satellite map with three overlaid shot patterns (average path = blue, min-shots round = green, max-shots round = red)

**Map images** require `VITE_GOOGLE_MAPS_API_KEY` in `.env` and the **Maps Static API** enabled for your key in Google Cloud. Without the key, PDFs still include the stats and a note that map images were skipped.

### 1. Run the report (saves to folder + PDFs)

From the project root:

```bash
npm run weekly-report
```

This writes the report to **`weekly-reports/report_YYYY-MM-DD.txt`** and PDFs to **`weekly-reports/pdfs/weekly_<profile>.pdf`** (e.g. `weekly_0_HCP.pdf`, `weekly_EW_2K.pdf`, `weekly_LPGA_Tour.pdf`). Install **pdfkit** if needed: `npm install pdfkit`.

### 2. Send the report by email

Uses the same `.env` as the daily summary (GMAIL_USER, GMAIL_APP_PASSWORD). Optional: set `WEEKLY_REPORT_RECIPIENT` in `.env` (defaults to kenzcole96@gmail.com).

```bash
npm run weekly-report:send
```

Attachments: all 6 profile PDFs.

### 3. Schedule for Mondays at 9:00 AM

**Cron (macOS/Linux)**

```bash
crontab -e
```

Add (replace `PATH_TO_PROJECT` with your project path):

```
0 9 * * 1 cd /PATH_TO_PROJECT && npm run weekly-report:send
```

Runs every Monday at 9:00 AM (system timezone). For 9 AM PST use `TZ=America/Los_Angeles` in the line or in a wrapper script.

**macOS launchd**

Create e.g. `~/Library/LaunchAgents/com.pinhigh.weekly-report.plist` with `StartCalendarInterval` for **Weekday 1** (Monday), **Hour 9**, **Minute 0**, and `ProgramArguments`: `["/usr/bin/env", "npx", "tsx", "/PATH_TO_PROJECT/scripts/weekly-report.ts", "--send"]`, plus `WorkingDirectory` and env for Gmail.

### Summary

| Action | Command |
|--------|--------|
| Generate report + PDFs | `npm run weekly-report` |
| Generate + email (with PDFs) | `npm run weekly-report:send` |
