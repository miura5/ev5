## Phase      0 (not started) · gate items 0 / 6
## Running    nothing
## Waiting on Matt   the one-time setup in MATT.md, step by step (in the build chat)
## Next       finish the setup, then Phase 0 (S-01 to S-08)
## Staging    none yet   ## Live  ev4 build (unchanged)

### Decisions so far (these move into the Chart through `ops/record`, S-02/S-04)
- 2026-11-02 · Matt: hard limit §2.1.1 ("no personal data in the repo") is removed. Matt is accountable for his own data. The CI personal-data scan becomes a secrets scan. Secrets still never go in files.
- 2026-11-02 · Build manager: the approved mock-up is folded into PLAN (§4, §5.3, §5.6, §5.10, §6.1, §6.4, §7, §8, §10–§13, §15), with each edit marked `[Mock-up: …]`.
- 2026-11-02 · Build manager: the mock-up's cross-type screens (collection page, saved view, Recently deleted) and the sidebar live in a new top-level `shell/` folder. `areas/` stays six areas.
- 2026-11-02 · Build manager: no new job kind. "Write with E.V." is the practice set job's drafts output, and "Make cards" is the same job with cards, after cutover.
- 2026-11-02 · Build manager: weak spots keep no glyph (the eight types stand). "Mark as learned" is ev4's `solid` event.
- 2026-11-02 · Build manager: repeat rules are written in `domain/time`, with no recurrence library.
- 2026-11-02 · Matt: "all defaults" for C1–C15 and E-1, E-2, as PLAN §15 states them. So: E-1/C14 copy on first edit; E-2/C15 the repo may hold personal data, while staging, fixtures, logs and builder prompts stay synthetic or id-only; C13 owning things at cutover; C1–C12 as written. S-04 files these into the Chart.
- 2026-11-02 · Matt confirmed the folded mock-up is `design/mockup.html` from `ev5-mockup-kit-approved.zip` ("Approved · round 7", SHA-256 d7da8531…684f42).
- 2026-11-02 · Build manager: created `miura5/ev5` and pushed `main`. GitHub Free blocks branch protection and environment secrets on private repos, and required reviewers on a private repo need Enterprise (checked in GitHub's docs on 2026-11-02).
- 2026-11-02 · Matt: made `miura5/ev5` **public** (C10 changed), so branch protection, required checks and the "live" environment needing his approval work on Free. Everything committed, history included, is public.
- 2026-11-02 · Matt: v5 staging stays in his **existing Cloudflare account**, the same one as ev-live (this replaces his earlier "separate account"). A Cloudflare token covers the whole account, so the staging token could also change ev-live and its D1. Matt accepts that.
- 2026-11-02 · Build manager, because of the above: the staging workflow names the v5 staging Worker and D1 explicitly. A CI check (S-15) fails any wrangler config or workflow outside the live workflow that names ev-live or its D1. The staging and live tokens stay separate secrets, so each can be revoked on its own.
