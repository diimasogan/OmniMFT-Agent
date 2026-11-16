import sys
from pptx import Presentation
from pptx.util import Emu
prs = Presentation(sys.argv[1]); W, H = prs.slide_width, prs.slide_height
issues = 0
for n, slide in enumerate(prs.slides, 1):
    for sh in slide.shapes:
        if sh.left is None: continue
        if sh.left < 0 or sh.top < 0 or sh.left + sh.width > W + 9525 or sh.top + sh.height > H + 9525:
            print(f"slide {n}: OUT OF BOUNDS {sh.name}"); issues += 1
        if not sh.has_text_frame or not sh.text_frame.text.strip(): continue
        w_in = Emu(sh.width).inches; h_in = Emu(sh.height).inches; lines = 0.0; size_used = 14
        for para in sh.text_frame.paragraphs:
            txt = "".join(r.text for r in para.runs)
            sizes = [r.font.size.pt for r in para.runs if r.font.size] or [None]
            size = sizes[0] or 14; size_used = size
            bold = any(r.font.bold for r in para.runs)
            cpi = 72 / (size * (0.56 if bold else 0.50))   # avg chars per inch (Calibri/Cambria approx)
            indent = 0.3 if para._p.pPr is not None and para._p.pPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}buChar') is not None else 0
            per_line = max(1, int((w_in - indent) * cpi))
            lines += max(1, -(-len(txt) // per_line)) * size * 1.2 / 72 + (size * 0.25 / 72)
        if lines > h_in * 1.08:
            print(f"slide {n}: possible overflow in '{sh.name}' need~{lines:.2f}in have {h_in:.2f}in :: {sh.text_frame.text[:60]!r}"); issues += 1
print("issues:", issues)
