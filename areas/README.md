# areas/

One folder per sidebar item (today, ask, library, notes, progress, activity). Each has `area.ts` (route, nav entry, commands it adds), its view, `parts/` and tests. Imports follow §drift.imports.

<!-- generated:start -->
Interface: area activity, area ask, area collection, area deleted, area library, area notes, area progress, area sessions, area today
Must not import (§drift.imports): shell, commands except commands/client.ts, jobs, data, server, ops
<!-- generated:end -->
