"""Collect all storybooks (3 languages each) into one data file for the app.

Pictures and shared SVG drawings come from the English page of each story (they are the
same in every edition). Each edition contributes its own text. Arabic editions also give
their word-meaning list. All SVG ids are prefixed per story so books never clash.
"""
import json, re, sys, os

SRC = sys.argv[1]
OUT = sys.argv[2]

STORIES = [
    # key, file stem, group, (en file override)
    ("hairdresser", "hairdresser", "brave", "hairdresser.html"),
    ("ukhdud", "ukhdud", "brave", None),
    ("kahf", "kahf", "brave", None),
    ("three", "three", "brave", None),
    ("garden", "garden", "brave", None),
    ("asiya", "asiya", "brave", None),
    ("ant", "ant", "brave", None),
    ("turnip", "turnip", "world", None),
    ("pot", "pot", "world", None),
    ("coat", "coat", "world", None),
    ("grandpa", "grandpa", "world", None),
    ("horse", "horse", "world", None),
    ("league", "league", "sherlock", None),
    ("jewel", "jewel", "sherlock", None),
    ("students", "students", "sherlock", None),
    ("crown", "crown", "sherlock", None),
    ("riddle", "riddle", "sherlock", None),
]

DEFS_RE = re.compile(r'<svg width="0" height="0" style="position:absolute" aria-hidden="true">\s*<defs>(.*?)</defs>\s*</svg>', re.S)
ART_RE = re.compile(r'<article class="page( cover| glossary)?"(?: hidden)?>(.*?)</article>', re.S)
FIG_RE = re.compile(r'<figure class="art">(.*?)</figure>', re.S)
SERIES_RE = re.compile(r'<p class="series">(.*?)</p>', re.S)
H1_RE = re.compile(r'<h1>(.*?)</h1>', re.S)
SUB_RE = re.compile(r'<p class="sub">(.*?)</p>', re.S)
GL_RE = re.compile(r'<div class="gl"><span class="w">(.*?)</span><span class="m">(.*?)</span></div>', re.S)
NUM_RE = re.compile(r'<p class="num">.*?</p>', re.S)


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def prefix_ids(svg_text, ids, p):
    def rep_id(m):
        return 'id="%s%s"' % (p, m.group(1)) if m.group(1) in ids else m.group(0)
    def rep_href(m):
        return '%s="#%s%s"' % (m.group(1), p, m.group(2)) if m.group(2) in ids else m.group(0)
    def rep_url(m):
        return 'url(#%s%s)' % (p, m.group(1)) if m.group(1) in ids else m.group(0)
    s = re.sub(r'id="([^"]+)"', rep_id, svg_text)
    s = re.sub(r'(href|xlink:href)="#([^"]+)"', rep_href, s)
    s = re.sub(r'url\(#([^)]+)\)', rep_url, s)
    return s


def text_of(article_inner):
    body = FIG_RE.sub("", article_inner, count=1).strip()
    if body.startswith('<div class="text">'):
        body = body[len('<div class="text">'):]
        body = body[:body.rfind('</div>')]
    return NUM_RE.sub("", body).strip()


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s).strip()


data = []
for idx, (key, stem, group, en_override) in enumerate(STORIES):
    p = "s%d-" % (idx + 1)
    en_html = read(en_override or (stem + "-en.html"))
    defs = "".join(m.group(1) for m in DEFS_RE.finditer(en_html))
    ids = set(re.findall(r'id="([^"]+)"', defs))
    defs = prefix_ids(defs, ids, p)

    arts = ART_RE.findall(en_html)
    scenes = []
    for kind, inner in arts:
        fm = FIG_RE.search(inner)
        scenes.append(prefix_ids(fm.group(1).strip(), ids, p) if fm else "")

    story = {"key": key, "group": group, "defs": defs, "scenes": scenes, "langs": {}}
    for lang in ("en", "ar", "bn"):
        html = en_html if lang == "en" else read(stem + "-" + lang + ".html")
        pages, gloss = [], []
        for kind, inner in ART_RE.findall(html):
            if kind == " glossary":
                gloss = [{"w": w.strip(), "m": strip_tags(m)} for w, m in GL_RE.findall(inner)]
                continue
            pages.append(text_of(inner))
        cover = pages[0]
        h1 = H1_RE.search(cover)
        sub = SUB_RE.search(cover)
        series = SERIES_RE.search(html)
        story["langs"][lang] = {
            "title": strip_tags(h1.group(1)) if h1 else key,
            "subtitle": strip_tags(sub.group(1)) if sub else "",
            "series": strip_tags(series.group(1)) if series else "",
            "pages": pages,
            "glossary": gloss,
        }
        if len(pages) != len(scenes):
            print("WARNING page/scene mismatch", key, lang, len(pages), len(scenes))
    data.append(story)
    print("%-12s scenes=%2d  en=%2d ar=%2d bn=%2d  gloss=%d" % (
        key, len(scenes), len(story["langs"]["en"]["pages"]), len(story["langs"]["ar"]["pages"]),
        len(story["langs"]["bn"]["pages"]), len(story["langs"]["ar"]["glossary"])))

with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.STORIES = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
