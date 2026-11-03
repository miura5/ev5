# Frozen ev4 data contract: source

ev4 commit: `9d9af38bd868d47d761264578319fe8d5b9b63be` (miura5/ev4, read 2026-11-02).

- `schemas/`: the 36 files of ev4's `spec/schemas/`, copied byte for byte (`cp -p`), never edited.
- `collections.json`: extracted from ev4's `spec/ev.spec.json` (SHA-256 `5e4d4c0e95fc9be9b219b456cf80752ca2219ecced2fd36d83dfc7be74beafde`): for each collection its
  class, writers, marks, append maps and per-document entries, plus `capacity.documentBytes` and `capacity.batch`.
  The extract only drops fields; every value is as ev4 has it.

Nothing here changes inside the rollback window. `frozen.test.ts` fails when any file's SHA-256 differs from this
table, or when a file is added or missing. To re-freeze from a newer ev4 commit, copy again and rewrite this table in
one commit, with the reason.

| File | SHA-256 |
|---|---|
| `schemas/announcements.schema.json` | `80aefeffba313b38f44235b74f45628ca173dc711ea19fd80bde5044e957e6ae` |
| `schemas/answers.schema.json` | `07fb1d299343e00e8d9b61ce99b2ce5652424b20bf1719736e980a67c4b19cec` |
| `schemas/concepts.schema.json` | `9bbcdba6bd777fe311f7aa93a38899ff7ecaf98386dc700c2bc80632e54a8bd7` |
| `schemas/dateedits.schema.json` | `f4224c02fc660e3d4855e2b4b83ac18a3f78df96b38ff024489f45b02fb648ec` |
| `schemas/dates.schema.json` | `4ab8e83d8b763bbfe78eaff8395fb34778f4977a21fa820611422bbd39d8c646` |
| `schemas/dayedits.schema.json` | `03805e4f0d253bba6814cf9a226094795092128632ae213fe1a0dfa1de187ee1` |
| `schemas/days.schema.json` | `5f87ecd47cde3eed035f6401abcbe7c1123a70f3a3bd6072a859673ca14abfe7` |
| `schemas/debug.schema.json` | `2ea410189459a27b8fa042ea5db62dfbb1a756f5c80a3819fdf30ab9692c1cbf` |
| `schemas/decks.schema.json` | `3c64ddba6357f1c92e454e0f921b0cfbef413fb5a6a381feca72bb05c7bd4272` |
| `schemas/examedits.schema.json` | `a77af54257a956299cbc195c360a52f3f54c77bdc35e8c52d12e91d08f5ec210` |
| `schemas/exams.schema.json` | `9d799d9ded6ac32c11d98c7b640af936bce29a0b1a3d77588ce7c2bc9f3252ee` |
| `schemas/health.schema.json` | `ac4f4ae2d1ee82f8ae9eeabfa92e3d3bbbe7062d35dd14d3ee08759d76c8370e` |
| `schemas/idchecks.schema.json` | `ec00a77b1ee993043934c3e9862db5bb062928d80a278c402452987a846b2028` |
| `schemas/ideas.schema.json` | `df4b9fba2d47131d741d167d719df153429137a7848f04525c5bae0576865fb5` |
| `schemas/jobresults.schema.json` | `6bf297597a45636b39ac05180c2a841928c9091df2e5e04086b7351ff38bb95c` |
| `schemas/jobs.schema.json` | `93358fab109e8c9fe9300da55398e334e086400474de4bc5f7346aba105ec230` |
| `schemas/journal.schema.json` | `45adca42557ea573dee00412d747436e6dd37da40edaa2fbde5b5f75fb478743` |
| `schemas/legacy.schema.json` | `656cc6d00f73f1d46fc3ab3584bbba2ea50160c6eac75a5615daa2a43b5fdd42` |
| `schemas/libindex.schema.json` | `9a90b843f903f39fe2cde2e179ab9fab22905795fe1119e9f3eea2f8711d54d1` |
| `schemas/materialedits.schema.json` | `beafd0478a538b96049e09b3a3d5c2164900bfdbb4b7b3d6a0e185e70d1f05c6` |
| `schemas/materials.schema.json` | `3594028d5b37f6ff255d27dff73faff3f37fd5bbc0aa8aa46bafea5634f2027a` |
| `schemas/notes.schema.json` | `5a9cc6406b3d2dad93658a0b97cac28f3904ece083022bc5fead8e99f34519c0` |
| `schemas/objectives.schema.json` | `8935e46870d2f53714382e1371492135228d4d69c189e2552701b7e71c9be0f3` |
| `schemas/planedits.schema.json` | `624a4ea90f88e6d76ba656e3467e0cf80fbf05bf7d3c5b69b750ed802b574e6b` |
| `schemas/plans.schema.json` | `dadcc22dff5852ab79c76bc99c9b6d050b93cf245ff6296960046432860d03cc` |
| `schemas/predictions.schema.json` | `9e32a34298447fbe63f356a0374a41f14da39fbdb323e43d4bd655e8ed9ec118` |
| `schemas/runs.schema.json` | `6ac9fa70330acddbc00997ff0e129755b0184930d3556bb5855b696b76b1a126` |
| `schemas/sessions.schema.json` | `72b6cd7709d28dd5f54cff92ffc469f40a1961cf69e42c4276accd5cd99c13b2` |
| `schemas/sets.schema.json` | `bc4f6e12ee8e6c3df2aacb3c33d199163947767557ccf74a493a5b9cb1c2f4ee` |
| `schemas/settings.schema.json` | `28f8d5cb1946430b10eef3979103c2dc31cf3bc26c64998d6383800fccabcaae` |
| `schemas/state.schema.json` | `8b2448c194335a8c4a25b5eb8778739be3cd026c1f5f73c7c8bb8a4e1b817c39` |
| `schemas/system.schema.json` | `6c36d125a40b0c2c835b48ebe63b2ef666193993288507753bb3e10bd35765bf` |
| `schemas/talk.schema.json` | `75c2c316579d969aef017191c99bd32a2e81f194956e835daf80232e049b366c` |
| `schemas/weakspots.schema.json` | `929cca2d9fd80998ae88cd7d270942cdf6f7ba14cdedc713178c24f5f6a29edb` |
| `schemas/weeks.schema.json` | `d7b4973e8f9089b3564c7a58aceed06acd788740aab944ef298385473c7cf85a` |
| `schemas/workouts.schema.json` | `0cda3aa03eb1a4418fa2a262162a743383f44c86695f27ef001037f6f7f6ff6b` |
| `collections.json` | `75e01225db549da89dd76ceabbeab6da69eca8dc41e9863792e0c53583566039` |
