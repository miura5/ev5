#!/usr/bin/env python3
"""Build one status snapshot of the E.V. v5 build (public repo miura5/ev5) as JSON on stdout.

Reads only public GitHub data, no token: about 6 to 12 REST calls plus two raw files.
The "ev5 build" page shows this snapshot. Run it, then write the output to the page's
db document status/now. Thresholds follow the build manager's rules: a lock held over
75 min, a PR open over 2 h or failing, and no merge for 3 h are flagged.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = "miura5/ev5"
API = f"https://api.github.com/repos/{REPO}"
RAW = f"https://raw.githubusercontent.com/{REPO}/main"
CENTRAL = timezone(timedelta(hours=-6))  # America/Chicago, standard time (Nov to Mar)
NOW = datetime.now(timezone.utc)


def get(url, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": "ev5-status", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
    return body if raw else json.loads(body)


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def mins(t):
    return round((NOW - t).total_seconds() / 60)


def iso(t):
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if t else None


def short_title(t):
    """Drop a leading task id ("B-790: ") so the page shows words, not ids."""
    t2 = re.sub(r"^(B-\d+(, B-\d+)*|Chart|Docs|AGENTS|Handover)\s*:\s*", "", t)
    t2 = re.sub(r"\s*\((?:[BDS]-\d+(?:,\s*)?)+\)", "", t2)
    return t2.strip() or t


def kind(t):
    """'record' for Chart, handover and claim housekeeping; 'build' for real work."""
    return "record" if re.match(r"^(Chart|Handover|Docs)\s*:", t) or "handover" in t.lower() else "build"


def task_num(i):
    m = re.match(r"B-(\d+)$", i)
    return int(m.group(1)) if m else -1


def main():
    alerts = []

    tasks = json.loads(get(f"{RAW}/chart/tasks.json", raw=True))
    title_of = {t["id"]: t["title"] for t in tasks}

    # 1. Run lock
    lc = get(f"{API}/commits/claude/build-lock")
    msg = lc["commit"]["message"].splitlines()[0]
    at = ts(lc["commit"]["committer"]["date"])
    held = msg.startswith("held by")
    lock = {"held": held, "since": iso(at), "ageMin": mins(at)}
    if held and mins(at) > 75:
        alerts.append({"level": "bad", "text": f"The run lock is held for {mins(at)} min with no renew. The run may be stuck."})

    # 2. Pull requests and CI runs
    open_prs = get(f"{API}/pulls?state=open&per_page=50")
    closed = get(f"{API}/pulls?state=closed&sort=updated&direction=desc&per_page=100")
    runs = get(f"{API}/actions/runs?per_page=60")["workflow_runs"]

    def checks_for(sha):
        rs = [r for r in runs if r["head_sha"] == sha and r["name"] == "CI"]
        if not rs:
            return "none"
        r = rs[0]
        if r["status"] != "completed":
            return "running"
        return "pass" if r["conclusion"] == "success" else "fail"

    builders = []
    for p in open_prs:
        opened = ts(p["created_at"])
        state = checks_for(p["head"]["sha"])
        b = {
            "title": short_title(p["title"]),
            "url": p["html_url"],
            "branch": p["head"]["ref"],
            "openedMin": mins(opened),
            "checks": state,
            "draft": p.get("draft", False),
        }
        builders.append(b)
        if state == "fail":
            alerts.append({"level": "bad", "text": f"Checks fail on: {b['title']}"})
        if mins(opened) > 120:
            alerts.append({"level": "warn", "text": f"Open for {mins(opened) // 60} h {mins(opened) % 60} min: {b['title']}"})

    # Claim branches with work but no PR yet (skip branches whose head is a closed PR's head).
    closed_heads = {p["head"]["sha"] for p in closed}
    open_heads = {p["head"]["ref"] for p in open_prs}
    for br in get(f"{API}/branches?per_page=100"):
        name = br["name"]
        if not name.startswith("claude/B-") or name in open_heads or br["commit"]["sha"] in closed_heads:
            continue
        c = get(f"{API}/commits/{br['commit']['sha']}")
        when = ts(c["commit"]["committer"]["date"])
        if mins(when) > 6 * 60:
            continue  # old leftover branch
        m = re.match(r"claude/(B-\d+)", name)
        builders.append({
            "title": (title_of.get(m.group(1)) or c["commit"]["message"].splitlines()[0]).split(" Done when:")[0] if m else name,
            "url": f"https://github.com/{REPO}/tree/{name}",
            "branch": name,
            "openedMin": mins(when),
            "checks": "nopr",
            "draft": False,
        })

    # 3. Merges today (Central time) and the last merge
    midnight = datetime.now(CENTRAL).replace(hour=0, minute=0, second=0, microsecond=0)
    merged = sorted((p for p in closed if p.get("merged_at")), key=lambda p: p["merged_at"], reverse=True)
    merges = [
        {"title": short_title(p["title"]), "url": p["html_url"], "at": p["merged_at"], "kind": kind(p["title"])}
        for p in merged
        if ts(p["merged_at"]) >= midnight
    ]
    last_merge = ts(merged[0]["merged_at"]) if merged else None
    if last_merge and mins(last_merge) > 180:
        alerts.append({"level": "warn", "text": f"No merge for {mins(last_merge) // 60} h."})

    # 4. CI and staging on main
    def latest_main(name):
        rs = [r for r in runs if r["name"] == name and r["head_branch"] == "main" and r["event"] == "push"]
        if not rs:
            return None
        r = rs[0]
        state = "running" if r["status"] != "completed" else ("pass" if r["conclusion"] == "success" else "fail")
        title = r["display_title"]
        pm = re.match(r"Merge pull request #(\d+)", title)
        if pm:
            title = next((p["title"] for p in closed if str(p["number"]) == pm.group(1)), title)
        return {"state": state, "at": r["created_at"], "url": r["html_url"], "title": short_title(title)}

    main_ci = {"ci": latest_main("CI"), "staging": latest_main("staging")}
    if main_ci["ci"] and main_ci["ci"]["state"] == "fail":
        alerts.append({"level": "bad", "text": "CI is red on main."})
    if main_ci["staging"] and main_ci["staging"]["state"] == "fail":
        alerts.append({"level": "bad", "text": "The staging deploy failed."})

    # 5. Handover lines
    ho = get(f"{RAW}/docs/handover.md", raw=True)

    def line(label):
        m = re.search(rf"^## {label}\s+(.*)$", ho, re.M)
        return m.group(1).strip() if m else ""

    nxt = line("Next")
    next_items = [s.strip().rstrip(".") + "." for s in re.split(r"\(\d+\)\s*", nxt) if s.strip()]
    staging_line = line("Staging").split("##")[0].strip()
    handover = {"phase": line("Phase"), "running": line("Running"), "waiting": line("Waiting on Matt"),
                "next": next_items, "staging": staging_line}

    # 6. Drift fixes from the Chart

    def group(lo, hi):
        items = [t for t in tasks if lo <= task_num(t["id"]) <= hi]
        return {
            "total": len(items),
            "done": sum(t["status"] == "done" for t in items),
            "doing": sum(t["status"] == "in progress" for t in items),
            "items": [{"title": t["title"], "status": t["status"]} for t in items],
        }

    drift = {"kit": group(787, 790), "audit": group(795, 826)}

    print(json.dumps({
        "asOf": iso(NOW),
        "lock": lock,
        "builders": builders,
        "merges": merges,
        "lastMerge": iso(last_merge),
        "main": main_ci,
        "alerts": alerts,
        "handover": handover,
        "drift": drift,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"build_status: {e}", file=sys.stderr)
        sys.exit(1)
