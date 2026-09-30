"""Build data/official.json + data/img/ from official/bank.json and official/images.json.
  python tools/build_official.py
"""
import json, re, shutil, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
bank = json.load(open(R / "official/bank.json", encoding="utf-8"))
imgs = json.load(open(R / "official/images.json"))
CJK = "　-鿿＀-￯"
def clean(s):
    s = re.sub(rf"(?<=[{CJK}])\s+(?=[{CJK}])", "", s.strip())
    s = re.sub(rf"(?<=[{CJK}])\s+(?=[\d])|(?<=[\d])\s+(?=[{CJK}])", "", s)
    s = re.sub(r"(?<=\d,)\s+(?=\d)", "", s)
    return re.sub(r"\s+", " ", s)
out = pathlib.Path(R / "data/img"); out.mkdir(exist_ok=True)
qs = []
for b in bank:
    q = {"id": f"O-{b['no']:03d}", "no": b["no"], "cat": b["cat"], "q": clean(b["q"]),
         "options": [clean(o).rstrip("。") for o in b["options"]], "answer": b["answer"] - 1}
    im = imgs.get(str(b["no"]))
    if im:
        shutil.copyfile(R / "official/img_tmp" / im[0], out / im[0]); q["image"] = "data/img/" + im[0]
    qs.append(q)
cats = []
for q in qs:
    if q["cat"] not in cats: cats.append(q["cat"])
json.dump({"version": "115.1", "source": "交通部公路局 機車駕駛人筆試題庫（115年1月1日版，NTM-00725）", "license": "政府資料開放授權條款第1版",
           "cats": cats, "questions": qs}, open(R / "data/official.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(qs), "questions,", sum(1 for q in qs if "image" in q), "with image")
