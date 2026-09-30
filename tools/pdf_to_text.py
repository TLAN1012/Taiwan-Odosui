"""Extract page-tagged text from the official PDF with pypdf.
  python tools/pdf_to_text.py official/NTM-00725_zh.pdf official/zh_pypdf.txt
"""
import sys
from pypdf import PdfReader
out = []
for i, pg in enumerate(PdfReader(sys.argv[1]).pages, 1):
    out.append(f"=====PAGE {i} imgs={len(pg.images)}\n" + (pg.extract_text() or ""))
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(out))
