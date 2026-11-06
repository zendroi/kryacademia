# Company catalog import

The supplied `EKSKUL KLASS 2026_2027.xlsx` is read-only. Import only catalog columns from `Schools Schedule`, `Jadwal Harian Ekskul 2026`, `Tanggal Kelas Berjalan`, and institution totals from `Students Data`. Do not execute formulas, workbook links or embedded content. Fees, accounts and attendance history are not copied.

## Run

Use the supported Node version and Python 3.10+ (standard library only):

```powershell
node --env-file=.env.local scripts/migrate-portal-revisions.mjs
node --env-file=.env.local scripts/import-company-catalog.mjs "C:\path\EKSKUL KLASS 2026_2027.xlsx"
node --env-file=.env.local scripts/import-company-catalog.mjs "C:\path\EKSKUL KLASS 2026_2027.xlsx" --apply
```

Preview is the default. It writes only an ignored local report under `outputs/company-import/`; database records change only with `--apply`. Each apply saves the prior catalog in that directory before the transaction writes. Audit events retain the workbook SHA-256 and sheet/row references. The original JSON archive and teaching submissions are asserted unchanged. Existing pilot records remain active until archival is confirmed, and later admin edits are not overwritten by another import.

The default `--master=consensus` takes consistent values, leaves conflicting scalar values blank, and assigns only coach names shared by the source rows. After the company confirms precedence, `--master=daily` or `--master=schools` selects that sheet's supplied values and retains the conflict report. Missing fields still use consensus; they are never invented. Non-CONFIRMED rows and marketing prospects do not create active groups.

## Data distinctions

- Klass type is shared. Group/grade, timetable, reported headcount and planned semester meetings belong to each class group.
- `reportedStudents` is a company headcount, not a pupil roster. No placeholder pupils are created. Registered/enrolled counts remain calculated from actual profiles/enrollments. The institution-level report is not the sum of every class enrollment because pupils may attend multiple classes.
- `plannedMeetings` is the semester target; actual meeting dates, syllabus deadlines and Canva assignments still require admin configuration. Attendance is verified only through Approved journals, never from an imported plan or spreadsheet name entry.
- Coach names do not create login accounts or grant access. Admin must verify identities and link an approved teacher account. Do not substitute old dummy staff photos for unverified real coaches.
- New school groups use provisional Onsite mode because the source has no delivery-mode column. Admin must verify it.
- Student links are discovered but not opened by the importer. Names require a separate authorized, private roster import with student identity and class matching.
- A Grade 11 row naming SMP rather than SMA is held as a conflict, not duplicated into the junior school. Date cells containing ambiguous Excel-converted values are not expanded into calendar meetings.

## Current source checks

The supplied file yields 9 institutions, 25 confirmed groups (including 12 Technova grade/groups) and 376 reported pupils across the institution summary. Gloria 1 and Gloria 3 now explicitly have Innovation classes. Unresolved differences include Ciputra time, Visual Thinker meeting count, Xin Zhong headcounts, Cikal/Chung Chung/Coding coach lists, and the misplaced Grade 11 row.

```powershell
node tests/company-catalog-check.mjs "C:\path\EKSKUL KLASS 2026_2027.xlsx"
node --env-file=.env.local tests/company-import-check.mjs "C:\path\EKSKUL KLASS 2026_2027.xlsx"
```

The integration check creates its own random PostgreSQL schema, checks preview/apply/repeat/admin edits, and tests class detail/editor at desktop and mobile widths against the production build. It never imports into the operational schema.

## Confirmed pilot archival and Ciputra correction

After the user's explicit confirmation, preview and apply the scoped cleanup:

```powershell
node --env-file=.env.local scripts/archive-pilot-catalog.mjs
node --env-file=.env.local scripts/archive-pilot-catalog.mjs --apply
```

This deactivates recognized, unchanged-name pilot seed records and unused aggregate Technova placeholders superseded by grade/group records. It preserves all rows, foreign-key references, the JSON archive and teaching submissions. Modified or non-pilot records are not archived indiscriminately. The user-confirmed Ciputra time is Monday 15:00-16:00, audited independently from the still-conflicting source workbook. Reimport must not overwrite that confirmed edit or reactivate the old seed records. The integration test checks this path as well.

Linked rosters can be downloaded read-only with `node scripts/read-roster-sources.mjs workbook.xlsx`. Each run creates a separate ignored, private timestamped directory under `outputs/company-rosters/`; it does not publish student names, change sharing permissions, or import them into PostgreSQL. Reconcile active status, institution totals and multi-class enrollment before importing roster records. The dated reconciliation checklist is kept in ignored `outputs/company-review/`, not the public site or repository.
