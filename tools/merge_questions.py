"""Merge data/q_parts/*.json into data/questions.json (validated).  python tools/merge_questions.py"""
import datetime, json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
parts = sorted((ROOT / "data" / "q_parts").glob("*.json"))
if subprocess.call([sys.executable, str(ROOT / "tools" / "validate_questions.py"), *map(str, parts)]):
    sys.exit("validation failed; not merging")
topics = json.loads((ROOT / "tools" / "topics.json").read_text(encoding="utf-8"))
qs = []
for p in parts:
    qs += json.loads(p.read_text(encoding="utf-8"))
used = {q["topic"] for q in qs}
out = {"version": datetime.date.today().isoformat(), "topics": [t for t in topics if t["id"] in used], "questions": qs}
(ROOT / "data" / "questions.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("merged", len(qs), "questions from", len(parts), "files")
