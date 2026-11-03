#!/usr/bin/env python3
"""Usage: python analyze_har.py file.har [api-host-substring]
Prints request totals, API vs Next prefetch, bytes, repeated API calls (parallel vs later), 4xx/5xx."""
import json, sys, collections
from urllib.parse import urlparse
from datetime import datetime
f = sys.argv[1]; api_host = sys.argv[2] if len(sys.argv) > 2 else "onrender.com"
ts = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
e = json.load(open(f))["log"]["entries"]
api = [x for x in e if api_host in x["request"]["url"]]
fe = [x for x in e if api_host not in x["request"]["url"]]
xfer = lambda L: sum(max(x["response"].get("_transferSize", 0) or 0, 0) for x in L)
print(f"total={len(e)} api={len(api)} frontend/prefetch={len(fe)} transferred={xfer(e)}B (api {xfer(api)}B)")
g = collections.defaultdict(list)
for x in api: g[(x["request"]["method"], x["request"]["url"])].append(ts(x["startedDateTime"]))
dup = sum(len(t) - 1 for t in g.values())
par = sum(1 for t in g.values() for a, b in zip(sorted(t), sorted(t)[1:]) if b - a < 1)
print(f"duplicate API calls={dup} (of which fired within 1s of each other: {par})")
for (m, u), t in sorted(g.items(), key=lambda kv: -len(kv[1])):
    if len(t) > 1: print(f"  x{len(t)} {m} {urlparse(u).path}{'?' + urlparse(u).query if urlparse(u).query else ''}")
for x in e:
    if x["response"]["status"] >= 400: print("  FAIL", x["response"]["status"], urlparse(x["request"]["url"]).path)
