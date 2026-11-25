#!/usr/bin/env python3
"""Build the BOOTH demo (体験版) from index.html.

The demo is the same game with DEMO switched on: the standard scenario only, stages 1-2
(個人投資家・大株主), ending at the third stage or after five in-game years, with its own save slot.
Only lines outside the ATLAS3D section are touched; the section is copied byte for byte.

Usage: python3 tools/make-demo.py [output.html]   (default: atlas-capital-demo.html next to index.html)
"""
import hashlib, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'atlas-capital-demo.html')


def section(s):
    a = s.index('<!-- ATLAS3D BEGIN'); b = s.index('-->', s.index('<!-- ATLAS3D END')) + 3
    return s[a:b]


EDITS = [
    ('const DEMO = false;', 'const DEMO = true;'),
    ('<title>Atlas Capital</title>', '<title>Atlas Capital 体験版</title>'),
    ('<small>GLOBAL RAID SIMULATOR</small>', '<small>GLOBAL RAID SIMULATOR · 体験版</small>'),
]
s = src
for a, b in EDITS:
    n = s.count(a)
    if n != 1:
        sys.exit(f'make-demo: expected one "{a}", found {n}')
    s = s.replace(a, b)
if section(s) != section(src):
    sys.exit('make-demo: the ATLAS3D section changed')
open(out, 'w', encoding='utf-8').write(s)
print(out, len(s.encode('utf-8')), 'bytes; ATLAS3D sha256', hashlib.sha256(section(s).encode('utf-8')).hexdigest()[:12])
