"""Fetch statutes from 全國法規資料庫 (law.moj.gov.tw) and build data/laws.json.

  python tools/build_laws.py            # fetch (cached in raw/) + build
  python tools/build_laws.py --refetch  # ignore cache

Source page text is the newest promulgated text. Articles whose amendment is promulgated but not yet in force
(施行日期由行政院另定) are stored with the in-force text (from the site's 舊法規內容 page) plus the pending text.
"""
import html, json, pathlib, re, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
RAW.mkdir(exist_ok=True)
LAWS = [("K0040012", "道路交通管理處罰條例"), ("K0040013", "道路交通安全規則"), ("K0040014", "道路交通標誌標線號誌設置規則")]
BASE = "https://law.moj.gov.tw/LawClass/"
refetch = "--refetch" in sys.argv


def fetch(url, name):
    p = RAW / name
    if refetch or not p.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "Taiwan-Odosui/1.0 (personal study tool)"})
        p.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return p.read_text(encoding="utf-8")


def clean(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).replace("　", "　").strip()


def roc_date(h):
    m = re.search(r"修正日期：</th>\s*<td>\s*民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日", h)
    return f"{int(m.group(1)) + 1911}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else None


def parse_current(h):
    """article no -> list of lines [{'t':text,'lv':indent level}], plus chapter per article."""
    arts, order, chapter = {}, [], ""
    pat = re.compile(r'<div class="h3 char-\d+">(.*?)</div>|<div class="row"><div class="col-no">\s*<a[^>]*name="([^"]+)">[^<]*</a></div>'
                     r'<div class="col-data">(<div class="text-danger">.*?</div>)?<div class="law-article">(.*?)</div>\s*</div></div>', re.S)
    ch = sec = ""
    for m in pat.finditer(h):
        if m.group(1) is not None:
            hd = re.sub(r"\s+", " ", clean(m.group(1)))
            if re.search(r"章", hd.split()[0:3].__str__()) and not re.search(r"節", hd):
                ch, sec = hd, ""
            else:
                sec = hd
            chapter = (ch + " " + sec).strip()
            continue
        no = m.group(2)
        partial = m.group(3) is not None
        lines = []
        for lm in re.finditer(r'<div class="line-(\d+)[^"]*">(.*?)</div>', m.group(4), re.S):
            lv = {"0000": 0, "0004": 1, "0006": 2}.get(lm.group(1), 1)
            lines.append({"t": clean(lm.group(2)), "lv": lv})
        arts[no] = {"chapter": chapter, "lines": lines, "partial": partial}
        order.append(no)
    return arts, order


def parse_old(h):
    """In-force (舊法規內容) page is hard-wrapped plain text; rebuild paragraphs heuristically."""
    out = {}
    for m in re.finditer(r'<div class="row"><div class="col-no">第 ([\d\- ]+?) 條</div><div class="col-data text-pre">(.*?)</div></div>', h, re.S):
        no = m.group(1).replace(" ", "")
        raw = html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).split("\n")
        paras = []
        for ln in raw:
            if not ln.strip():
                continue
            indented = ln.startswith("    ") or ln.startswith("　　")
            starts_item = re.match(r"^[一二三四五六七八九十]+、|^（[一二三四五六七八九十]+）|^\([一二三四五六七八九十]+\)", ln.strip())
            prev_end = paras and re.search(r"[。：；]$", paras[-1]["t"])
            if paras and indented:
                paras[-1]["t"] += ln.strip()
            elif not paras or starts_item or prev_end:
                paras.append({"t": ln.strip(), "lv": 1 if starts_item else 0})
            else:
                paras[-1]["t"] += ln.strip()
        out[no] = paras
    return out


def norm(lines):
    return re.sub(r"\s+", "", "".join(l["t"] for l in lines))


def pending_articles(h):
    """Article numbers named in the 施行日期由行政院以命令定之 notes."""
    m = re.search(r"生效狀態：\s*</th>(.*?)</tr>", h, re.S)
    if not m:
        return set(), ""
    note = clean(m.group(1)).replace("\xa0", " ")
    nums = set()
    for seg in re.findall(r"修正之第.*?施行日期", note):
        seg = re.sub(r"第\s*[\d、\s]+項", " ", seg)
        nums |= set(re.findall(r"\d+(?:-\d+)?", seg))
    return nums, re.sub(r"\s+", " ", note)


def main():
    out = {"built_from": "全國法規資料庫 law.moj.gov.tw（政府資料開放授權條款第1版）", "laws": []}
    for pcode, name in LAWS:
        h = fetch(f"{BASE}LawAll.aspx?pcode={pcode}", f"{pcode}.html")
        arts, order = parse_current(h)
        pend, note = pending_articles(h)
        old = {}
        if pend:
            old = parse_old(fetch(f"{BASE}LawOldVer.aspx?pcode={pcode}", f"{pcode}_old.html"))
        items = []
        for no in order:
            a = arts[no]
            text = a["lines"]
            item = {"no": no, "chapter": a["chapter"], "lines": text}
            if a["partial"]:
                item["partial"] = True
            if no in pend and no in old and norm(old[no]) != norm(text):
                item["lines"] = old[no]
                item["pending_lines"] = text
                item["pending_note"] = "本條修正已公布但尚未施行（施行日期由行政院以命令定之），上方為現行有效條文；考試以現行有效條文為準。"
            items.append(item)
        out["laws"].append({"pcode": pcode, "name": name, "amended": roc_date(h), "status_note": note or None,
                            "url": f"https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode={pcode}", "articles": items})
        print(name, len(items), "articles; pending:", sorted(pend))
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "laws.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


main()
