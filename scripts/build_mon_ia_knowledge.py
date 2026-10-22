#!/usr/bin/env python3
"""
Build Mon IA's knowledge base for the server.

  Input : scripts/data/mon_ia_knowledge_source.txt     (YOUR approved facts, edit freely)
  Output: server/monIaKnowledge.js                     (GENERATED, published records only)

Run from the project root:   python scripts/build_mon_ia_knowledge.py
The output is only ever read by the server function in api/mon-ia.js. It is NOT part of the
website's browser code. If a check fails, nothing is written and the problem is printed.
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "data" / "mon_ia_knowledge_source.txt"
OUT = ROOT / "server" / "monIaKnowledge.js"

CATEGORIES = ["identity", "expertise", "philosophy", "projects", "articles", "contact", "privacy", "assistant_rules"]
STATUSES = ["published", "draft"]
ID_RE = re.compile(r"^[a-z]+(?:-[a-z0-9]+)+$")
HEADER_RE = re.compile(r"^##\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*$")
URL_RE = re.compile(r"https?://[^\s<>()\"']+", re.I)
MAX_PUBLISHED_CHARS = 40000   # about 10,000 tokens: every request carries the whole knowledge base
WARN_PUBLISHED_CHARS = 25000

# things that must never be in a public knowledge base
SECRET_PATTERNS = [
    (re.compile(r"AIza[0-9A-Za-z_\-]{30,}"), "looks like a Google API key"),
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}"), "looks like an API secret key"),
    (re.compile(r"sb_secret_[A-Za-z0-9_\-]+"), "looks like a Supabase secret key"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}"), "looks like a token (JWT)"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY"), "looks like a private key"),
    (re.compile(r"(?i)\b(password|passwd|api[_ ]?key|secret|token)\s*[:=]\s*\S+"), "looks like a credential (password, key or token)"),
]


def fail(problems):
    print("\nMon IA knowledge NOT built - fix these first:\n")
    for p in problems:
        print("  -", p)
    print()
    sys.exit(1)


def parse(text):
    records, problems, cur, in_text = [], [], None, False
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("##"):
            if cur:
                records.append(cur)
            m = HEADER_RE.match(stripped)
            if not m:
                problems.append(f"line {number}: bad header, expected  ## id | category | status")
                cur, in_text = None, False
                continue
            cur = {"id": m.group(1), "category": m.group(2), "status": m.group(3).lower(),
                   "title": "", "source": "", "text_lines": [], "line": number}
            in_text = False
            continue
        if cur is None:
            if stripped and not stripped.startswith("#"):
                problems.append(f"line {number}: text outside a record: {stripped[:40]}")
            continue
        if in_text:
            if stripped:
                cur["text_lines"].append(stripped)
            continue
        if not stripped or (stripped.startswith("#") and not stripped.startswith("##")):
            continue
        if stripped.startswith("Title:"):
            cur["title"] = stripped[6:].strip()
        elif stripped.startswith("Source:"):
            cur["source"] = stripped[7:].strip()
        elif stripped.startswith("Text:"):
            in_text = True
            rest = stripped[5:].strip()
            if rest:
                cur["text_lines"].append(rest)
        else:
            problems.append(f"line {number}: unknown line in {cur['id']}: {stripped[:40]}")
    if cur:
        records.append(cur)
    return records, problems


def validate(records):
    problems, seen = [], {}
    for r in records:
        where = f"{r['id']} (line {r['line']})"
        if not ID_RE.match(r["id"]):
            problems.append(f"{where}: id must look like expertise-ai (lowercase words joined by -)")
        if r["id"] in seen:
            problems.append(f"{where}: duplicate id (first on line {seen[r['id']]})")
        seen[r["id"]] = r["line"]
        if r["category"] not in CATEGORIES:
            problems.append(f"{where}: unknown category '{r['category']}' (use one of: {', '.join(CATEGORIES)})")
        if r["status"] not in STATUSES:
            problems.append(f"{where}: status must be published or draft, not '{r['status']}'")
        if not r["title"]:
            problems.append(f"{where}: missing Title:")
        if not r["source"]:
            problems.append(f"{where}: missing Source:")
        if not r["text_lines"]:
            problems.append(f"{where}: missing Text:")
        body = "\n".join(r["text_lines"])
        for pattern, why in SECRET_PATTERNS:
            if pattern.search(body) or pattern.search(r["title"]):
                problems.append(f"{where}: {why}. Secrets must NEVER go in the knowledge base.")
        for url in URL_RE.findall(body):
            clean = url.rstrip(".,;:!?)")
            if not clean.lower().startswith("https://"):
                problems.append(f"{where}: link must start with https:// -> {clean}")
            if re.search(r"[?&](utm_|ref=|fbclid|gclid)", clean, re.I) or "chatgpt.com" in clean.lower():
                problems.append(f"{where}: remove the tracking part from this link -> {clean}")
    return problems


def main():
    parser = argparse.ArgumentParser(description="Build Mon IA's knowledge base.")
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    if not args.source.exists():
        fail([f"missing {args.source}"])

    records, problems = parse(args.source.read_text(encoding="utf-8"))
    problems += validate(records)
    published = [r for r in records if r["status"] == "published"]
    size = sum(len(l) for r in published for l in r["text_lines"])
    if not published:
        problems.append("no published records")
    if size > MAX_PUBLISHED_CHARS:
        problems.append(f"published text is {size} characters; the limit is {MAX_PUBLISHED_CHARS}. Shorten it or move records to draft.")
    if problems:
        fail(problems)

    knowledge = [{"id": r["id"], "category": r["category"], "title": r["title"],
                  "text": "\n".join(r["text_lines"]), "source": r["source"]} for r in published]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    body = ",\n".join("  " + json.dumps(k, ensure_ascii=False) for k in knowledge)
    args.out.write_text(
        "// GENERATED by scripts/build_mon_ia_knowledge.py - do not edit by hand.\n"
        "// Edit scripts/data/mon_ia_knowledge_source.txt, then run the script again.\n"
        "// Server-side only: never import this file from anything under src/.\n"
        f"export const KNOWLEDGE = [\n{body}\n];\n", encoding="utf-8")
    back = args.out.read_text(encoding="utf-8")
    parsed = json.loads(back[back.index("= [") + 2: back.rindex("];") + 1])
    if len(parsed) != len(knowledge):
        fail([f"{args.out} was written but reads back with the wrong number of records"])

    drafts = [r for r in records if r["status"] == "draft"]
    print(f"Wrote {args.out}")
    print(f"Published: {len(published)} records, {size} characters (limit {MAX_PUBLISHED_CHARS})")
    for category, n in sorted(Counter(r["category"] for r in published).items()):
        print(f"  {n:2d}  {category}")
    if size > WARN_PUBLISHED_CHARS:
        print("NOTE: the knowledge base is getting large; every question sends all of it to the AI.")
    if drafts:
        print(f"\nHidden drafts ({len(drafts)}), NOT visible to Mon IA until you change them to published:")
        for r in drafts:
            print(f"  - {r['id']}: {r['title']}")


if __name__ == "__main__":
    main()
