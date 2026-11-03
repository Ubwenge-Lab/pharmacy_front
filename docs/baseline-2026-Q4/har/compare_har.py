#!/usr/bin/env python3
"""Usage: python compare_har.py before.har after.har [api-host-substring]

Same counting rules as analyze_har.py (API = URL contains the host substring,
default onrender.com; a duplicate = same method and URL seen more than once;
parallel = two calls of the same URL less than 1 s apart). Prints one markdown
row for the audit table, plus the endpoints whose call count changed.
"""
import json, sys, collections
from urllib.parse import urlparse
from datetime import datetime

def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()

def stats(path, host):
    e = json.load(open(path))["log"]["entries"]
    api = [x for x in e if host in x["request"]["url"]]
    xfer = lambda L: sum(max(x["response"].get("_transferSize", 0) or 0, 0) for x in L)
    g = collections.defaultdict(list)
    for x in api:
        g[(x["request"]["method"], urlparse(x["request"]["url"]).path)].append(ts(x["startedDateTime"]))
    full = collections.defaultdict(list)
    for x in api:
        full[(x["request"]["method"], x["request"]["url"])].append(ts(x["startedDateTime"]))
    dup = sum(len(t) - 1 for t in full.values())
    par = sum(1 for t in full.values() for a, b in zip(sorted(t), sorted(t)[1:]) if b - a < 1)
    return {
        "total": len(e), "api": len(api), "dup": dup, "par": par,
        "e4": sum(1 for x in e if 400 <= x["response"]["status"] < 500),
        "e5": sum(1 for x in e if x["response"]["status"] >= 500),
        "kb": round(xfer(e) / 1024), "paths": {k: len(v) for k, v in g.items()},
    }

if len(sys.argv) < 3:
    sys.exit(__doc__)
host = sys.argv[3] if len(sys.argv) > 3 else "onrender.com"
b, a = stats(sys.argv[1], host), stats(sys.argv[2], host)
name = sys.argv[1].replace(".before", "").replace(".sanitized", "").rsplit("/", 1)[-1].replace(".har", "")
print("| Surface | Requests b/a | API calls b/a | Duplicate API b/a | Parallel dup b/a | 4xx b/a | 5xx b/a | KB b/a |")
print("|---|---|---|---|---|---|---|---|")
print(f"| {name} | {b['total']} / {a['total']} | {b['api']} / {a['api']} | {b['dup']} / {a['dup']} | "
      f"{b['par']} / {a['par']} | {b['e4']} / {a['e4']} | {b['e5']} / {a['e5']} | {b['kb']} / {a['kb']} |")
print("\nEndpoints whose call count changed (before -> after):")
for k in sorted(set(b["paths"]) | set(a["paths"])):
    x, y = b["paths"].get(k, 0), a["paths"].get(k, 0)
    if x != y:
        print(f"  {k[0]} {k[1]}: {x} -> {y}")
