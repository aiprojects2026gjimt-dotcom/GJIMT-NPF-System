# GJIMT NPF CRM — Admin / Counsellor update

## IMPORTANT — Which project is this?
This ZIP is for **GJIMT-NPF-System** (Admission CRM), NOT the separate **NPFSchoolData** Student Data Center project. Do not upload the Student Data Center ZIP into the NPF CRM repository.

## What changed
- Two-button login choice: Admin or Counsellor; role verified against Apps Script account on login.
- Admin sees all leads, assignments, counsellor monitoring, hot/warm/cold counts and CSV import.
- Counsellor sees only assigned leads, assigned-lead KPIs, calls, follow-ups, activity timeline, lead score and messaging tools.
- Score classification: hot >=75, warm 40–74, cold <40. Counsellor score updates are immediately stored in the Google Sheet and appear after the admin dashboard refresh.
- Lead-stage update automatically sets the corresponding default score. To override, update the score AFTER the stage.
- Admin-only CSV import, 40 rows per request, skips duplicate phone numbers and invalid Indian phone numbers.
- Existing UltraMsg, Netlify proxy, admin accounts, Sheets and other CRM functions preserved.

## Deployment 1: GitHub Pages frontend
Upload/replace these files at the ROOT of https://github.com/aiprojects2026gjimt-dotcom/GJIMT-NPF-System on the main branch:
- index.html
- app.js
- styles.css
- config.js
- assets/gjimt-logo.png and assets/25-years-logo.png (only if missing)
Keep the existing Netlify function files `netlify/functions/api.mjs` and `netlify.toml`.
Wait for GitHub Pages to publish, then hard refresh (Ctrl+Shift+R).

## Deployment 2: Google Apps Script backend
Open your EXISTING Apps Script project `mainNPFCode`, connected via its `SHEET_ID` script property to the existing `GJIMT NPF Admission CRM` Google Sheet.
1. Back up the existing Code.gs.
2. Replace Code.gs with `Code.gs` from this ZIP.
3. Save, then Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
4. Keep the SAME web app deployment URL in Netlify's APPS_SCRIPT_URL; do not create a new Google Sheet or run setup() again.
5. Preserve the existing BRIDGE_SHARED_SECRET and SHEET_ID in Apps Script script properties, and the matching secret in Netlify. Never place secrets in GitHub.

## Google Sheet connection (NO new Excel connection needed)
Your existing Google Sheet `GJIMT NPF Admission CRM` is already the database. Apps Script opens it using the script property `SHEET_ID`. All CRM leads are read from its **Leads** tab. The first row must contain these exact column names, in order:
`id,name,phone,email,program,percentage,source,stage,assignedTo,score,nextFollowUp,lastContact,createdAt,notes,skillX,studentUserId`
Do not rename or reorder columns. The `Users`, `Activities`, `Sends`, `Sessions`, `Settings` etc. tabs must remain.

### Bring existing Excel leads into CRM
Option A: In the Admin dashboard, click **Student Leads > Import CSV**. In Excel choose File > Save As > CSV UTF-8. In Google Sheets choose File > Download > Comma-separated values (.csv). CSV headings must include `name,phone`; optional `email,program,percentage,source,notes`. Import does not overwrite existing leads; duplicate phone numbers are skipped. Phone numbers must be valid Indian mobile numbers (10 digits or 91+10 digits).
Option B: Copy rows from Excel to the existing Google Sheet Leads tab, keeping the 16-column schema and unique IDs. Option A is strongly recommended, because it generates IDs automatically and checks phone numbers.

## Admin / Counsellor testing
- Sign in as admin, confirm existing leads appear in Student Leads. Assign a lead using the Assigned to dropdown.
- Sign out; select Counsellor Login and sign in using a counsellor account created under Counsellors > Create Login.
- Confirm ONLY that counsellor's assigned leads appear. Open a lead, save a call, update stage, set follow-up, update score.
- Sign out; log in as admin and refresh. Confirm updated hot/warm/cold count, stage and activity.
- WhatsApp requires valid ULTRAMSG_INSTANCE, ULTRAMSG_TOKEN and SENDER_ENABLED TRUE in the Settings tab. Test only with an authorized real phone number.

## Hosting
GitHub Pages remains the public frontend. Netlify hosts only the secure serverless proxy. Google Apps Script operates on the existing Google Sheet. Do not publish the Netlify secret or UltraMsg token in GitHub.

## Limitations
This is a code-level update, not a live deployment. We cannot validate your private Netlify/Google Apps Script credentials or actual Google Sheet rows here. The dashboard refreshes counts after a saved change or page reload; it does not stream other users' changes in real time.
