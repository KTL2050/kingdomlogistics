# /monthly-report

Generate a report on last month's shipment activity in the Kingdom Trading Shipment Control Tower (TRACKER), pulled live from Supabase.

## Context

TRACKER follows shipments from suppliers in China, through Mombasa Port, to the Kampala store. Progress after Mombasa comes from manual updates by the Logistics Manager, not from GPS or a shipping-line integration. That means a gap in updates is not the same as nothing happening, so this report treats update gaps as a finding, never as stability.

## Steps

1. **Determine the period.** Default to the previous full calendar month. If I gave a specific month, use that instead.

2. **Inspect the schema before assuming anything.** Look at `types/` and `lib/` (or wherever the Supabase client and generated types live) and confirm the actual tables and columns for shipments, containers, manual tracking updates, alerts and companies. Don't guess field names. If the schema is ambiguous or you can't find something, stop and ask me.

3. **Query Supabase for that period.** Confirm which date fields exist (ETA, actual arrival, created, status change, update time) and which one defines "in this period" for each section below. Say which you used.

4. **Build the report with these sections:**
   - **Headline numbers:** shipments and containers handled in the period, and how many arrived, are still in transit, or are delayed.
   - **By company:** a separate section for each company found in the data (for example Aiwibi Uganda and Uncle Bills), then a group total. Never merge companies into one figure without showing the split.
   - **Delivery performance:** for shipments that arrived in the period, the difference in days between ETA and actual arrival. Count a shipment as late if it arrived after its ETA, and state that this is the definition used.
   - **Delays and outstanding actions:** shipments delayed at the end of the period, with their open alerts grouped by type (border verification, tax payments, port clearance, other) and how long each has been open.
   - **Update timeliness:** for shipments in transit during the period, the longest gap between manual updates. Report the gaps. Don't judge them unless I have given a threshold.
   - **Carried over:** anything unresolved from before the period, listed separately and never folded into this month's counts.
   - **Data problems:** a container or shipment missing a required field, a duplicate ID, a date outside a sane range. List these as exceptions. Don't silently drop or fix them.

5. **Format.** A short markdown file: headline numbers first, then the sections above, with compact tables where they help. Save it to `reports/YYYY-MM-shipment-report.md` in the repo, creating `reports/` if it doesn't exist.

6. **Tell me it's ready.** Don't commit, push or send it anywhere. That follows the normal CLAUDE.md approvals, and sending it to anyone is my decision.

## Notes

- This command is read-only. It never writes to Supabase.
- If Supabase is unreachable or a query fails, say so plainly rather than reporting partial numbers as if they were complete.
- Where the data can't answer a section (for example no field records update times), say that, and leave the section out rather than estimating.