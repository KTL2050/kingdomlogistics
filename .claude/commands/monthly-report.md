# /monthly-report

Generate a report on last month's container activity, pulled live from Supabase.

## Steps

1. **Determine the period.** Default to the previous full calendar month (e.g. if run in October, report on September 1–30). If I gave a specific month as an argument, use that instead.

2. **Inspect the schema before assuming anything.** Look at `types/` and `lib/` (or wherever the Supabase client and generated types live) to confirm the actual table and column names for containers — don't guess field names from memory of a typical schema. If the schema is ambiguous or you can't find it, stop and ask rather than guessing.

3. **Query Supabase for that period.** Pull every container record whose relevant date (added/created/moved — confirm which field this repo actually uses) falls inside the target month.

4. **Build the report with:**
   - Total containers added in the period
   - Breakdown by status (if a status field exists) — e.g. in transit, delivered, delayed
   - Any containers still showing as unresolved/pending from *before* this period (carried-over items — flag these separately, don't fold them into the new-this-month count)
   - Anything that looks like a data problem (a container missing a required field, a duplicate ID, a date outside a sane range) — list these as exceptions, don't silently drop or "fix" them

5. **Format:** a short markdown file, not a long document. Headline numbers first, exceptions/flags section, then a compact table if there's a per-container breakdown worth showing. Save it to `reports/YYYY-MM-container-report.md` in the repo (create the `reports/` folder if it doesn't exist).

6. **Tell me it's ready.** Don't commit or push it — that follows the normal CLAUDE.md approval steps (ask before commit, ask again before push), same as any other change.

## Notes

- This pulls live data — if Supabase is unreachable or a query fails, say so plainly rather than reporting partial numbers as if they were complete.
- If this is the first time this command has been run, the schema-inspection step matters most — get it right once and it'll be fast every month after.