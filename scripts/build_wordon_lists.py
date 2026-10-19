#!/usr/bin/env python3
"""
Build the Wordon word lists for the website.

  Input : scripts/data/wordon_solutions_source.txt   (YOUR answer words, edit freely)
          scripts/data/wordon_blocklist.txt          (words that may never be answers)
          scripts/data/enable1.txt                   (OPTIONAL: the public-domain ENABLE
                                                      word list; gives the big guess list)
  Output: src/.../games/wordon/wordonSolutions.js    (answers, in a fixed daily order)
          src/.../games/wordon/wordonGuesses.js      (every word a player may guess)
          scripts/data/wordon_order.txt              (remembers the daily order)

Run from the project root:   python scripts/build_wordon_lists.py
The two .js files are GENERATED - never edit them by hand.

If a check fails the script prints what is wrong and exits WITHOUT writing anything.
"""
import argparse
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "scripts" / "data"
OUT_DIR = ROOT / "src" / "components" / "sections" / "ActivityCenter" / "games" / "wordon"

WORD_LENGTH = 4          # keep in sync with WORD_LENGTH in wordonLogic.js
MIN_SOLUTIONS = 200      # fewer answers than this would repeat too quickly
SEED = 20261017          # fixed, so the shuffled order is the same on every machine
WORD_RE = re.compile(rf"^[a-z]{{{WORD_LENGTH}}}$")


def read_word_file(path):
    """Return [(line_number, word)] ignoring blank lines and '# comments'."""
    found = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        for word in line.split("#")[0].split():
            found.append((number, word.lower()))
    return found


def write_and_verify(path, text, expected_words):
    """Write a generated .js file, read it straight back, and stop if it is not what we meant to write."""
    path.write_text(text, encoding="utf-8")
    back = path.read_text(encoding="utf-8")
    words = back.split('"')[1].split(" ") if back.count('"') >= 2 else []
    if len(words) != expected_words:
        fail([f"{path} was written but reads back with {len(words)} words instead of {expected_words}. "
              "Something else (an open editor tab, a sync tool, antivirus) may be overwriting it."])
    print(f"wrote {path.name:<20} {path.stat().st_size:>6} bytes  {len(words):>5} words  (checked)  {path}")


def fail(problems):
    print("\nWordon lists NOT built - fix these first:\n")
    for p in problems:
        print("  -", p)
    print()
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Build the Wordon word lists.")
    parser.add_argument("--enable", type=Path, default=DATA / "enable1.txt",
                        help="path to enable1.txt (default: scripts/data/enable1.txt)")
    parser.add_argument("--out", type=Path, default=OUT_DIR, help="folder for the generated .js files")
    parser.add_argument("--order", type=Path, default=DATA / "wordon_order.txt", help="daily order memory file")
    args = parser.parse_args()

    source = DATA / "wordon_solutions_source.txt"
    blocklist_path = DATA / "wordon_blocklist.txt"
    if not source.exists():
        fail([f"missing {source}"])

    # ---- 1. check the answers file -----------------------------------------
    problems = []
    blocklist = {w for _, w in read_word_file(blocklist_path)} if blocklist_path.exists() else set()
    seen, solutions = {}, []
    for number, word in read_word_file(source):
        if not WORD_RE.match(word):
            problems.append(f"line {number}: '{word}' is not exactly {WORD_LENGTH} letters a-z")
        elif word in blocklist:
            problems.append(f"line {number}: '{word}' is on the blocklist (never an answer)")
        elif word in seen:
            problems.append(f"line {number}: '{word}' is a duplicate (first on line {seen[word]})")
        else:
            seen[word] = number
            solutions.append(word)
    if len(solutions) < MIN_SOLUTIONS:
        problems.append(f"only {len(solutions)} valid answers, need at least {MIN_SOLUTIONS}")
    if problems:
        fail(problems)

    # ---- 2. the allowed (guess) list ---------------------------------------
    allowed = set(solutions)
    if args.enable.exists():
        dictionary = {w.strip().lower() for w in args.enable.read_text(encoding="utf-8", errors="ignore").split()}
        dictionary = {w for w in dictionary if WORD_RE.match(w)}
        not_in_dictionary = sorted(set(solutions) - dictionary)
        allowed |= dictionary
        print(f"ENABLE: {len(dictionary)} four-letter words found.")
        if not_in_dictionary:
            shown = ", ".join(not_in_dictionary[:40]) + (" ..." if len(not_in_dictionary) > 40 else "")
            print(f"WARNING: {len(not_in_dictionary)} answers are not in ENABLE (typo?): {shown}")
    else:
        print(f"NOTE: {args.enable} not found, so the guess list is ONLY your answer words.")
        print("      Download enable1.txt into scripts/data/ and run this script again for the full list.")

    # ---- 3. daily order: keep the old order, shuffle only NEW words --------
    previous = [w for _, w in read_word_file(args.order)] if args.order.exists() else []
    kept = [w for w in previous if w in seen]
    new_words = sorted(set(solutions) - set(kept))
    random.Random(SEED).shuffle(new_words)
    ordered = kept + new_words

    # ---- 4. write everything (only now that all checks passed) -------------
    args.out.mkdir(parents=True, exist_ok=True)
    banner = ("// GENERATED by scripts/build_wordon_lists.py - do not edit by hand.\n"
              "// Edit scripts/data/wordon_solutions_source.txt, then run the script again.\n")
    write_and_verify(args.out / "wordonSolutions.js",
                     banner + f'export const SOLUTIONS = "{" ".join(ordered)}".split(" ");\n', len(ordered))
    write_and_verify(args.out / "wordonGuesses.js",
                     banner + f'export const ALLOWED = "{" ".join(sorted(allowed))}".split(" ");\n', len(allowed))
    old_file = args.out / "wordonAllowed.js"  # the old name: remove it so it can never be mistaken for the real list
    if old_file.exists():
        old_file.unlink()
        print(f"removed the old file {old_file.name}")
    args.order.write_text(
        "# Daily order of the answers (generated). Keeping this file stops today's and\n"
        "# upcoming words from changing when you add new answers.\n" + "\n".join(ordered) + "\n",
        encoding="utf-8")

    print(f"Answers : {len(ordered)} ({len(new_words)} new this run)")
    print(f"Allowed : {len(allowed)} words a player may guess")
    print(f"Wrote   : {args.out}")


if __name__ == "__main__":
    main()
