#!/usr/bin/env python3
"""Usage: python sanitize_har.py input.har [output.har]

Offline, no internet needed. Removes what must never be committed and keeps
what the audit counts (URLs, methods, status, timings, sizes).

Removed: Authorization, Cookie, Set-Cookie and token headers, all cookies,
request bodies (login passwords), response bodies, and values of URL query
parameters whose names look like secrets. Kept: _transferSize, content size,
timings, status.

If no output name is given, writes <input name>.sanitized.har next to it.
The original file is never modified. Do not commit the original.
"""
import json, re, sys
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

SECRET_HEADERS = {"authorization", "cookie", "set-cookie", "proxy-authorization",
                  "x-auth-token", "x-csrf-token", "x-xsrf-token", "x-api-key"}
SECRET_PARAMS = re.compile(r"token|key|secret|password|pass|auth|code|session|jwt", re.I)

def clean_headers(headers):
    return [h for h in headers if h.get("name", "").lower() not in SECRET_HEADERS]

def clean_url(url):
    parts = urlsplit(url)
    if not parts.query:
        return url
    q = [(k, "REDACTED" if SECRET_PARAMS.search(k) else v) for k, v in parse_qsl(parts.query, keep_blank_values=True)]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else re.sub(r"(\.har)?$", ".sanitized.har", src, count=1)
    har = json.load(open(src, encoding="utf-8"))
    for e in har["log"]["entries"]:
        req, res = e["request"], e["response"]
        req["url"] = clean_url(req["url"])
        req["headers"] = clean_headers(req.get("headers", []))
        req["cookies"] = []
        req["queryString"] = [{"name": q["name"], "value": "REDACTED" if SECRET_PARAMS.search(q["name"]) else q["value"]}
                              for q in req.get("queryString", [])]
        req.pop("postData", None)
        res["headers"] = clean_headers(res.get("headers", []))
        res["cookies"] = []
        res["redirectURL"] = clean_url(res["redirectURL"]) if res.get("redirectURL") else ""
        content = res.get("content", {})
        res["content"] = {"size": content.get("size", 0), "mimeType": content.get("mimeType", "")}
        e.pop("_initiator", None)
        e.pop("_webSocketMessages", None)
    out = json.dumps(har, ensure_ascii=False, indent=1)
    json.dump(har, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Safety check on the file that was just written.
    leaks = []
    for label, pattern in [("JWT", r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
                           ("Bearer", r"Bearer\s+\S{10,}"),
                           ("password field", r'"password"\s*:'),
                           ("cookie header", r'"name":\s*"(?i:cookie|set-cookie|authorization)"')]:
        if re.search(pattern, out):
            leaks.append(label)
    print(f"wrote {dst}: {len(har['log']['entries'])} entries")
    if leaks:
        print("WARNING, still found:", ", ".join(leaks), "- do not commit this file")
        sys.exit(1)
    print("check passed: no tokens, passwords or cookies found")

if __name__ == "__main__":
    main()