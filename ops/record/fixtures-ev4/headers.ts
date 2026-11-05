// ev4's header lines, copied verbatim from its renderer, so a test can show the carried record prints exactly as
// ev4's committed BACKLOG.md and DECISIONS.md. The ids inside are ev4's text, not reasons in code.
import type { Headers } from '../render.ts';

const GENERATED =
  '**Generated from the Chart by `node tools/chart.mjs`: never edit this file by hand** (D-140, D-172).';
export const EV4_HEADERS: Headers = {
  backlog: [
    '# E.V. v4 build backlog',
    '',
    '**Generated from the Chart (chart/tasks.json) by `node tools/chart.mjs`: never edit this file by hand** (D-140).',
    'Change the record with `log`, `report` or `ship`; npm test fails when this file and the record differ.',
    'Status: `open` · `in progress` · `blocked` · `done`. A task opens when every id in Depends is `done`.',
  ],
  closedTasks:
    'Closed (done and declined) tasks are in chart/tasks.json: `node tools/chart.mjs brief --task <id>` or `trace`.',
  yourTurnIntro: 'What waits on Matt, by where it happens (`brief --matt` prints the same list).',
  decisions: [
    '# DECISIONS.md: E.V. v4 decisions and tenets',
    '',
    GENERATED,
    'Change one with `log decision`; npm test fails when this file and chart/decisions.json differ. D-001 to D-043 are',
    "in the v2 doc's decision log.",
    'Superseded decisions are in chart/decisions.json: `node tools/chart.mjs brief` or `trace`.',
  ],
};
