"""Validate question part files.  python tools/validate_questions.py data/q_parts/A.json [more.json ...]
Checks schema, that cited articles exist, and that `quote` is a verbatim substring of the cited article's IN-FORCE text."""
import json, pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
laws = {l["pcode"]: {a["no"]: a for a in l["articles"]} for l in json.loads((ROOT / "data/laws.json").read_text(encoding="utf-8"))["laws"]}
topics = {t["id"] for t in json.loads((ROOT / "tools/topics.json").read_text(encoding="utf-8"))}
norm = lambda s: re.sub(r"\s+", "", s)
BAD = ("以上皆是", "以上皆非", "以上皆對", "以上皆錯", "皆是", "皆非", "全部正確", "全部錯誤")
errs, warns, seen = [], [], set()
total = 0
for f in sys.argv[1:]:
    qs = json.loads(pathlib.Path(f).read_text(encoding="utf-8"))
    ans = collections.Counter()
    for q in qs:
        total += 1
        i = q.get("id", "?")
        def e(m): errs.append(f"{f} {i}: {m}")
        def w(m): warns.append(f"{f} {i}: {m}")
        for k in ("id", "topic", "q", "options", "answer", "refs", "quote", "explain"):
            if k not in q: e(f"missing {k}")
        if errs and errs[-1].startswith(f"{f} {i}: missing"): continue
        if q["id"] in seen: e("duplicate id")
        seen.add(q["id"])
        if q["topic"] not in topics: e(f"bad topic {q['topic']}")
        o = q["options"]
        if not (isinstance(o, list) and len(o) == 4 and all(isinstance(x, str) and x.strip() for x in o)): e("options must be 4 non-empty strings"); continue
        if len({norm(x) for x in o}) != 4: e("duplicate options")
        if not (isinstance(q["answer"], int) and 0 <= q["answer"] < 4): e("answer must be 0-3"); continue
        ans[q["answer"]] += 1
        if any(b in x for x in o for b in BAD): e("option uses 以上皆是/皆非 style")
        if not q["refs"]: e("no refs")
        text_all = ""
        for r in q["refs"]:
            a = laws.get(r.get("law"), {}).get(r.get("no"))
            if not a: e(f"ref not found {r}"); continue
            text_all += "".join(l["t"] for l in a["lines"])
            if a.get("partial"): w(f"cites partial article {r} (has tables/figures)")
        if q["quote"] and norm(q["quote"]) not in norm(text_all):
            e("quote is not a verbatim substring of cited in-force text")
            pend = "".join(l["t"] for r in q["refs"] for l in (laws.get(r.get("law"), {}).get(r.get("no"), {}).get("pending_lines") or []))
            if norm(q["quote"]) in norm(pend): e("  (quote matches the NOT-YET-IN-FORCE text)")
        if len(norm(q["quote"])) < 6: e("quote too short")
        if len(q["q"]) < 8: e("stem too short")
        if len(q["explain"]) < 15: e("explanation too short")
        if norm(q["q"]) in {norm(x) for x in o}: e("stem equals an option")
    print(f, len(qs), "questions; answer positions", dict(sorted(ans.items())))
print(f"{total} questions, {len(errs)} errors, {len(warns)} warnings")
for m in errs: print("ERR ", m)
for m in warns[:30]: print("WARN", m)
sys.exit(1 if errs else 0)
