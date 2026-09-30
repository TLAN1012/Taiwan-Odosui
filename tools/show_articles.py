"""Print articles of a statute as plain text.

  python tools/show_articles.py K0040012 12-39          # range (by position order, article numbers like 35-1 allowed)
  python tools/show_articles.py K0040013 77 79 85-2     # explicit numbers
"""
import json, pathlib, sys

d = json.loads((pathlib.Path(__file__).resolve().parent.parent / "data" / "laws.json").read_text(encoding="utf-8"))
law = next(l for l in d["laws"] if l["pcode"] == sys.argv[1])
nos = [a["no"] for a in law["articles"]]
want = []
for arg in sys.argv[2:]:
    if "-" in arg and arg.split("-")[0].isdigit() and arg.split("-")[1].isdigit() and arg not in nos:
        lo, hi = arg.split("-")
        i, j = nos.index(lo), nos.index(hi)
        want += nos[i:j + 1]
    else:
        want.append(arg)
by = {a["no"]: a for a in law["articles"]}
print(f"# {law['name']}（{law['amended']} 修正）")
for n in want:
    a = by[n]
    print(f"\n【第 {n} 條】{a['chapter']}" + ("  ※含圖表，僅文字部分" if a.get("partial") else ""))
    for l in a["lines"]:
        print("  " * l["lv"] + l["t"])
    if a.get("pending_lines"):
        print("  [此條修正未施行，上方為現行有效條文]")
