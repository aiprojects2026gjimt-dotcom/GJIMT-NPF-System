# GJIMT AspireHub — Update and deployment

## Important
This release preserves your existing CRM Google Sheet, users, counsellor assignments, lead stages and follow-ups. Back up the current Apps Script and Sheet before updating. Do NOT run setup() or seedDemo().

## External Google Sheet connection
Source: https://docs.google.com/spreadsheets/d/1SZNXJt1a-or5AiSDWhxAsDRgTzwlM8Wn9x765_M8HQw/edit

1. Open your existing Apps Script project associated with the CRM backend. Replace Code.gs with this release (back up original).
2. Confirm Script Properties SHEET_ID still points to the EXISTING CRM sheet, not the external source. Keep BRIDGE_SHARED_SECRET unchanged.
3. Run migrateAspireHub() ONCE in Apps Script editor, authorize access. This adds new columns to the CRM Leads tab and sets SOURCE_SHEET_ID to the external spreadsheet ID. Existing lead rows are not deleted.
4. Share the external source spreadsheet with the Google account executing Apps Script (Viewer permission is sufficient).
5. Deploy > Manage deployments > Edit > New version > Deploy. Keep the same /exec URL and Netlify configuration.
6. Replace frontend index.html, app.js, styles.css, config.js and assets in GitHub; retain netlify/functions/api.mjs and netlify.toml unless updating origin rules separately.
7. Admin login > Student Leads > Sync Google Sheet. First tab is used, with header row 1. Name and contact number required. Data is imported into CRM Leads; assignedTo, stage, score and follow-up are retained on existing leads matched by normalized phone number.
8. Admin Overview shows potential scholarship candidates and school/phone/marks. Scholarship is a PREVIEW, not verified eligibility.

## Expected source headers
Name (or Student Name), Contact No (or Mobile No/Phone), School, Last Class Percentage, Interested Area, Interested for Skill X, Interested for Course Program, Scholarship Eligible, Scholarship Category. Alternate common spellings are supported. If the source differs, adjust alias lists in syncSource_().

## Faster login
The frontend renders immediately after successful login and uses a single bootstrap request instead of four parallel requests. Google Apps Script / Sheets latency still depends on data size and service availability.

## Security
Keep the Netlify shared secret in Netlify and Apps Script properties only; never in GitHub. Do not publish student data or share spreadsheet edit access publicly. Sync is admin-only.

## Scholarship criteria
The uploaded ZIP already includes a scholarship reference list (e.g. merit above 90%, EWS and other categories). A separate scholarship image was not present with this request, so exact image-specific thresholds could not be verified. Update policy only after confirming the official scholarship document.
