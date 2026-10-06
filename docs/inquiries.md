# Landing Page Inquiries

The landing form saves inquiries to PostgreSQL. Admin > Inquiries, the recent-inquiries preview, and the admin notification list all read the same inbox. Teacher accounts and anonymous visitors cannot read the inbox or change statuses.

## Database Setup

Run this additive migration using the same `DATABASE_URL` as the portal. It does not seed demo inquiries or modify existing users/teacher records:

```powershell
node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFile} from 'node:fs/promises'; const sql=postgres(process.env.DATABASE_URL,{ssl:process.env.DATABASE_URL.includes('localhost')?false:'require'}); try {await sql.begin(async tx=>{await tx.unsafe(await readFile('database/inquiry.sql','utf8'));});} finally {await sql.end();}"
```

## Follow-Up

1. Send the landing form with the relevant Klass/program/request details and consent.
2. Open Admin > Inquiries; use Refresh inbox if the dashboard was already open.
3. Open an inquiry to see its contact, institution, language, message, and interests.
4. Use Reply by email or the WhatsApp link to contact the sender, then Mark contacted and Mark resolved. These statuses persist after reload.

Success appears only after the database confirms the save. Failed requests preserve the form. Retrying an identical submission uses the same UUID and does not create a duplicate. The server validates all fields, records consent time, and allows at most five inquiries per email per 15 minutes, with a hidden honeypot. This is a pilot spam barrier, not a CAPTCHA substitute. No automatic email/WhatsApp message is sent.

The current pilot loads the complete inbox; add server-side pagination as it grows. Other admin master-data screens remain demo data.

## Verification

```powershell
node --env-file=.env.local tests/inquiry-check.mjs
```

The check submits isolated test inquiries at desktop/mobile widths, checks database values, retries, validation, quota, role protection, status persistence, and screenshots. It deletes only inquiries using its randomly generated test emails.
