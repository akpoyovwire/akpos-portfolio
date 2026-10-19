#!/usr/bin/env python3
"""
Build the Quiz question bank for the website.

  Input : scripts/data/quiz_questions_source.txt     (YOUR questions, edit freely)
  Output: src/.../games/quiz/quizQuestions.js        (GENERATED: never edit by hand)

Run from the project root:
    python scripts/build_quiz.py             build with every question (good for testing)
    python scripts/build_quiz.py --strict    build ONLY questions marked  Verified: yes
                                             (use this for the final, published build)

If a check fails the script prints exactly what is wrong and writes NOTHING.
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "data" / "quiz_questions_source.txt"
OUT_DIR = ROOT / "src" / "components" / "sections" / "ActivityCenter" / "games" / "quiz"

# keep this list in sync with CATEGORIES in quizLogic.js
CATEGORIES = [
    "Movies and television", "Music", "Politics and government", "Art and literature", "History",
    "Geography", "Science and technology", "Sports", "Famous people and culture", "General knowledge",
]
DIFFICULTIES = ["easy", "medium"]
MIN_TOTAL = 100       # the directive asks for at least 100 questions
MIN_PER_CATEGORY = 10  # a quiz of 10 never runs out inside one category
ID_RE = re.compile(r"^[a-z]{2,6}-\d{3}$")
HEADER_RE = re.compile(r"^##\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*$")


def fail(problems):
    print("\nQuiz bank NOT built - fix these first:\n")
    for p in problems:
        print("  -", p)
    print()
    sys.exit(1)


def parse(text):
    """Return (questions, problems). Every problem mentions a line number."""
    questions, problems, cur = [], [], None

    def close():
        nonlocal cur
        if cur is not None:
            questions.append(cur)
        cur = None

    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        if line.startswith("##"):
            close()
            m = HEADER_RE.match(line)
            if not m:
                problems.append(f"line {number}: bad header, expected  ## id | Category | difficulty")
                cur = None
                continue
            cur = {"id": m.group(1), "category": m.group(2), "difficulty": m.group(3).lower(),
                   "question": "", "correct": [], "wrong": [], "explanation": "", "source": "",
                   "verified": False, "line": number}
            continue
        if cur is None:
            problems.append(f"line {number}: text outside a question block: {line[:40]}")
            continue
        if line.startswith("Q:"):
            cur["question"] = line[2:].strip()
        elif line.startswith("+"):
            cur["correct"].append(line[1:].strip())
        elif line.startswith("-"):
            cur["wrong"].append(line[1:].strip())
        elif line.startswith("Why:"):
            cur["explanation"] = line[4:].strip()
        elif line.startswith("Source:"):
            cur["source"] = line[7:].strip()
        elif line.startswith("Verified:"):
            value = line[9:].strip().lower()
            if value not in ("yes", "no"):
                problems.append(f"line {number}: Verified must be yes or no, not '{value}'")
            cur["verified"] = value == "yes"
        else:
            problems.append(f"line {number}: unknown line in {cur['id']}: {line[:40]}")
    close()
    return questions, problems


def validate(questions):
    problems = []
    ids, texts = {}, {}
    for q in questions:
        where = f"{q['id']} (line {q['line']})"
        if not ID_RE.match(q["id"]):
            problems.append(f"{where}: id must look like geo-012")
        if q["id"] in ids:
            problems.append(f"{where}: duplicate id (first on line {ids[q['id']]})")
        ids[q["id"]] = q["line"]
        if q["category"] not in CATEGORIES:
            problems.append(f"{where}: unknown category '{q['category']}'")
        if q["difficulty"] not in DIFFICULTIES:
            problems.append(f"{where}: difficulty must be easy or medium, not '{q['difficulty']}'")
        if not q["question"]:
            problems.append(f"{where}: missing Q: line")
        key = re.sub(r"\W+", " ", q["question"].lower()).strip()
        if key and key in texts:
            problems.append(f"{where}: same question text as {texts[key]}")
        texts[key] = q["id"]
        if len(q["correct"]) != 1:
            problems.append(f"{where}: needs exactly ONE correct answer (+), found {len(q['correct'])}")
        if len(q["wrong"]) != 3:
            problems.append(f"{where}: needs exactly THREE wrong answers (-), found {len(q['wrong'])}")
        options = q["correct"] + q["wrong"]
        if any(not o for o in options):
            problems.append(f"{where}: an answer is empty")
        lowered = [o.lower() for o in options]
        if len(set(lowered)) != len(lowered):
            problems.append(f"{where}: two answers are the same")
        if not q["explanation"]:
            problems.append(f"{where}: missing Why: explanation")
    return problems


def main():
    parser = argparse.ArgumentParser(description="Build the Quiz question bank.")
    parser.add_argument("--strict", action="store_true", help="only include questions marked Verified: yes")
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--out", type=Path, default=OUT_DIR, help="folder for quizQuestions.js")
    args = parser.parse_args()

    if not args.source.exists():
        fail([f"missing {args.source}"])
    questions, problems = parse(args.source.read_text(encoding="utf-8"))
    problems += validate(questions)

    included = [q for q in questions if q["verified"]] if args.strict else questions
    per_category = Counter(q["category"] for q in included)
    if len(included) < MIN_TOTAL:
        problems.append(f"only {len(included)} questions{' marked verified' if args.strict else ''}, need at least {MIN_TOTAL}")
    for category in CATEGORIES:
        if per_category[category] < MIN_PER_CATEGORY:
            problems.append(f"'{category}' has {per_category[category]} questions, needs at least {MIN_PER_CATEGORY}")
    if problems:
        fail(problems)

    bank = [{
        "id": q["id"], "category": q["category"], "difficulty": q["difficulty"], "question": q["question"],
        "options": q["correct"] + q["wrong"], "answer": q["correct"][0],
        "explanation": q["explanation"], "source": q["source"], "verified": q["verified"],
    } for q in included]

    args.out.mkdir(parents=True, exist_ok=True)
    target = args.out / "quizQuestions.js"
    body = ",\n".join("  " + json.dumps(item, ensure_ascii=False) for item in bank)
    target.write_text(
        "// GENERATED by scripts/build_quiz.py - do not edit by hand.\n"
        "// Edit scripts/data/quiz_questions_source.txt, then run the script again.\n"
        f"export const QUESTIONS = [\n{body}\n];\n", encoding="utf-8")

    # read it straight back and make sure it says what we meant
    back = target.read_text(encoding="utf-8")
    start, end = back.index("= [") + 2, back.rindex("];") + 1
    if len(json.loads(back[start:end])) != len(bank):
        fail([f"{target} was written but reads back with the wrong number of questions"])

    verified = sum(1 for q in included if q["verified"])
    print(f"Wrote {target}")
    print(f"Questions: {len(bank)} ({verified} marked verified, {len(bank) - verified} not yet)")
    for category in CATEGORIES:
        print(f"  {per_category[category]:3d}  {category}")
    if verified < len(bank):
        print("\nREMINDER: some questions are not marked Verified: yes. Check them against a")
        print("reliable source, mark them, then publish with:  python scripts/build_quiz.py --strict")


if __name__ == "__main__":
    main()
