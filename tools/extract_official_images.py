"""Assign PDF images to official questions by table-row position and save them.
  python tools/extract_official_images.py official/NTM-00725_zh.pdf official/bank.json data/img
"""
import json, os, re, sys
import pymupdf

pdf, bankf, outdir = sys.argv[1:4]
bank = json.load(open(bankf, encoding="utf-8"))
byno = {b["no"]: b for b in bank}
os.makedirs(outdir, exist_ok=True)
doc = pymupdf.open(pdf)
assign = {}  # no -> list of (page, rect, xref)
prev_last = None
for pi, page in enumerate(doc):
    anchors = []  # (y, no)
    d = page.get_text("dict")
    nums = []
    for blk in d["blocks"]:
        for ln in blk.get("lines", []):
            for sp in ln["spans"]:
                t = sp["text"].strip()
                if sp["bbox"][0] < 75 and re.fullmatch(r"\d+", t):
                    nums.append((sp["bbox"][1], int(t), sp["bbox"][0]))
    nums.sort()
    # a question number is followed (next line, near same x) by a single digit 1-3 answer
    for k, (y, n, x) in enumerate(nums):
        if n in byno and byno[n]["page"] == pi + 1 and (k + 1 < len(nums) and nums[k + 1][1] in (1, 2, 3) or True):
            if not anchors or anchors[-1][1] != n:
                anchors.append((y, n))
    anchors = [(y, n) for y, n in anchors if byno.get(n, {}).get("page") == pi + 1]
    for xref, *_ in page.get_images(full=True):
        for r in page.get_image_rects(xref):
            cy = (r.y0 + r.y1) / 2
            if not anchors or cy < anchors[0][0] - 12 and prev_last:
                no = prev_last
            else:
                no = anchors[0][1]
                for (y0, n0), (y1, n1) in zip(anchors, anchors[1:]):
                    if cy >= (y0 + y1) / 2 - 0:
                        no = n1
            assign.setdefault(no, []).append((pi + 1, r, xref))
    if anchors:
        prev_last = anchors[-1][1]

empty = {b["no"] for b in bank if not b["q"]}
print("images assigned:", sum(len(v) for v in assign.values()))
print("empty stems without image:", sorted(empty - set(assign)))
print("text stems with images:", sorted(n for n in assign if n not in empty))
print("multi-image questions:", {n: len(v) for n, v in assign.items() if len(v) > 1})
res = {}
for n, lst in assign.items():
    lst.sort(key=lambda t: (t[1].y0, t[1].x0))
    names = []
    for k, (p, r, xref) in enumerate(lst):
        info = doc.extract_image(xref)
        ext = info["ext"]
        name = f"q{n}-{k+1}.{ext}"
        open(os.path.join(outdir, name), "wb").write(info["image"])
        names.append(name)
    res[n] = names
json.dump(res, open(os.path.join(os.path.dirname(bankf), "images.json"), "w"), indent=1)
