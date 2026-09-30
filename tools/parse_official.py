"""Parse the official 機車駕照筆試題庫 PDF text into JSON.
  python tools/parse_official.py official/zh_pypdf.txt official/bank.json
"""
import json, re, sys

src, dst = sys.argv[1], sys.argv[2]
HDR = re.compile(r"^\s*機車駕照筆試題庫\s*115\.?\d*\s*$|^— \d+ —\s*$|^題號 答案 題目內容\s*$|^=====PAGE (\d+) imgs=(\d+)")
lines = open(src, encoding="utf-8").read().split("\n")
cat = sub = ""
page = 0
items = []  # dict(no, ans, raw:[lines], cat, sub, page)
cur = None
expect = 1
pending_sub = None
i = 0
while i < len(lines):
    l = lines[i].rstrip()
    i += 1
    m = re.match(r"^=====PAGE (\d+) imgs=(\d+)", l)
    if m:
        page = int(m.group(1)); continue
    if re.match(r"^\s*機車駕照筆試題庫", l) or re.match(r"^— \d+ —", l) or l.strip() == "題號 答案 題目內容" or not l.strip():
        continue
    if l.startswith("━"):
        # category banner: ━━ / title / ━━
        if i < len(lines) and not lines[i].startswith("━") and i + 1 < len(lines) and lines[i + 1].startswith("━"):
            cat = lines[i].strip(); i += 2
        continue
    m = re.match(r"^(\d+)\s+([123])(?:\s+(.*))?$", l)
    if m and int(m.group(1)) == expect:
        cur = {"no": expect, "ans": int(m.group(2)), "raw": [m.group(3)] if m.group(3) else [], "cat": cat, "sub": sub, "page": page}
        items.append(cur); expect += 1
        continue
    if cur is None:
        continue
    cur["raw"].append(l.strip())

MARK = r"[\(（]\s*%d\s*[\)）]"

def split(raw):
    txt = " ".join(raw)
    m1 = re.search(MARK % 1, txt)
    if not m1:
        return txt.strip(), []
    m2 = re.search(MARK % 2, txt[m1.end():])
    if not m2:
        return txt[:m1.start()].strip(), [txt[m1.end():].strip(), "", ""]
    a2 = m1.end() + m2.start(); b2 = m1.end() + m2.end()
    m3 = re.search(MARK % 3, txt[b2:])
    if not m3:
        return txt[:m1.start()].strip(), [txt[m1.end():a2].strip(), txt[b2:].strip(), ""]
    a3 = b2 + m3.start(); b3 = b2 + m3.end()
    return txt[:m1.start()].strip(), [txt[m1.end():a2].strip(), txt[b2:a3].strip(), txt[b3:].strip()]

out = []
for it in items:
    stem, opts = split(it["raw"])
    out.append({"no": it["no"], "answer": it["ans"], "q": stem, "options": opts, "cat": it["cat"], "page": it["page"]})
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "questions;", "empty stem:", sum(1 for o in out if not o["q"]), "bad opts:", sum(1 for o in out if len(o["options"]) != 3 or not all(o["options"])))
