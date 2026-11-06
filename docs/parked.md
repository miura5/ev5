# Parked findings

Findings from runs, reviews and audits that fit no open task while the task freeze holds (see the handover's Next). One line each, no task or decision ids. The build manager files them as tasks after the freeze ends.

- Prep plans for date kinds other than exam (a talk, a trip, a renewal): the date-kind registry gives other kinds a prep plan; Matt agreed the direction 2026-11-06.
- A time zone setting: `domain/time` reads the user's time zone from a setting instead of the one constant `ZONE` (America/Chicago today), so scheduled commands and the calendar day follow the user's own zone (§job.schedule).
