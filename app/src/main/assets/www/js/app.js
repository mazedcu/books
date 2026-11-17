/* Storybooks: library, page-turning reader, read-aloud and Arabic word exercises. */
(function () {
  "use strict";

  var STORIES = window.STORIES || [];
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- small helpers ---------- */
  function frag(html) { var r = document.createRange(); r.selectNodeContents(document.body); return r.createContextualFragment(html); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function svgFrag(inner) {
    var wrap = "<svg xmlns=\"http://www.w3.org/2000/svg\">" + inner + "</svg>";
    var doc = new DOMParser().parseFromString(wrap, "image/svg+xml");
    return doc.documentElement;
  }
  function digits(n, lang) {
    var s = String(n);
    if (lang === "ar") { return s.replace(/[0-9]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[+d]; }); }
    if (lang === "bn") { return s.replace(/[0-9]/g, function (d) { return "০১২৩৪৫৬৭৮৯"[+d]; }); }
    return s;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function store(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
  function load(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function fontsReady() {
    if (document.fonts && document.fonts.ready) { return document.fonts.ready; }
    return Promise.resolve();
  }

  /* ---------- words used in the app itself ---------- */
  var UI = {
    en: { app: "Storybooks", sub: "Stories to read and listen to", brave: "Stories of the Brave", world: "Stories from Around the World", sherlock: "Sherlock Holmes",
          foot: "Tap a book to open it. Swipe the page corner, or use the arrows, to turn pages. Press ▶ to listen.",
          pages: function (n) { return n + " pages"; } },
    ar: { app: "قِصَصِي", sub: "قِصَصٌ لِلْقِرَاءَةِ وَالِاسْتِمَاعِ", brave: "قِصَصُ الشُّجْعَانِ", world: "حِكَايَاتٌ مِنْ حَوْلِ الْعَالَمِ", sherlock: "شِرْلُوك هُولْمِز",
          foot: "اضْغَطْ عَلَى كِتَابٍ لِتَفْتَحَهُ، وَاسْحَبْ طَرَفَ الصَّفْحَةِ لِتَقْلِبَهَا، وَاضْغَطْ ▶ لِتَسْمَعَ الْقِصَّةَ.",
          pages: function (n) { return digits(n, "ar") + " صَفْحَةً · تَمَارِينُ"; } },
    bn: { app: "গল্পের বই", sub: "পড়ো আর শোনো", brave: "সাহসীদের গল্প", world: "বিশ্বের নানা দেশের গল্প", sherlock: "শার্লক হোমস",
          foot: "বই খুলতে ছুঁয়ে দাও। পাতার কোণা টেনে বা তীর চিহ্নে পাতা উল্টাও। শুনতে ▶ চাপো।",
          pages: function (n) { return digits(n, "bn") + " পাতা"; } }
  };
  var GLOSS_HEAD = "<h2 class=\"end\">مَعَانِي الْكَلِمَاتِ</h2><p class=\"en-sub\">Word Meanings</p>";
  var TEST_LINES = {
    en: "Bismillah. Let us read a story together.",
    ar: "بِسْمِ اللَّهِ، هَيَّا نَقْرَأُ قِصَّةً مَعًا.",
    bn: "বিসমিল্লাহ। চলো, একসাথে একটা গল্প পড়ি।"
  };

  /* ---------- settings ---------- */
  var prefs = load("prefs", { lang: "en", engine: "device", apiKey: "", rate: 0.9, auto: true, voices: { en: "", ar: "", bn: "" } });
  if (!prefs.voices) { prefs.voices = { en: "", ar: "", bn: "" }; }
  function applyPrefs() {
    TTS.configure({ engine: prefs.engine, apiKey: prefs.apiKey, rate: prefs.rate, voices: prefs.voices });
    store("prefs", prefs);
  }
  applyPrefs();

  /* ---------- story drawings ---------- */
  (function addDefs() {
    var defs = $("story-defs").querySelector("defs");
    for (var i = 0; i < STORIES.length; i++) {
      var parsed = frag("<svg><defs>" + STORIES[i].defs + "</defs></svg>");
      var src = parsed.querySelector("defs");
      while (src && src.firstChild) { defs.appendChild(document.importNode(src.firstChild, true)); src.removeChild(src.firstChild); }
    }
  })();

  function sceneNode(svgText) {
    var node = frag(svgText);
    return node;
  }

  /* ---------- library ---------- */
  function renderLibrary() {
    var lang = prefs.lang;
    var t = UI[lang];
    document.body.className = "lang-" + lang;
    document.documentElement.lang = lang;
    $("library").dir = lang === "ar" ? "rtl" : "ltr";
    var title = $("lib-title");
    title.replaceChildren(document.createTextNode(t.app), el("small", null, t.sub));
    $("shelf-brave").textContent = t.brave;
    $("shelf-world").textContent = t.world;
    $("shelf-sherlock").textContent = t.sherlock;
    $("lib-foot").textContent = t.foot;
    var langBtns = document.querySelectorAll(".langs button");
    for (var b = 0; b < langBtns.length; b++) {
      langBtns[b].setAttribute("aria-pressed", langBtns[b].getAttribute("data-lang") === lang ? "true" : "false");
    }
    var grids = { brave: $("grid-brave"), world: $("grid-world"), sherlock: $("grid-sherlock") };
    grids.brave.replaceChildren(); grids.world.replaceChildren(); grids.sherlock.replaceChildren();
    STORIES.forEach(function (s, i) {
      var L = s.langs[lang];
      var card = el("button", "card");
      card.setAttribute("aria-label", L.title);
      var cv = el("div", "cv");
      cv.appendChild(sceneNode(s.scenes[0]));
      card.appendChild(cv);
      card.appendChild(el("div", "ct", L.title));
      card.appendChild(el("span", "badge", t.pages(L.pages.length)));
      card.addEventListener("click", function () { openBook(i); });
      grids[s.group].appendChild(card);
    });
  }

  document.querySelector(".langs").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) { return; }
    prefs.lang = btn.getAttribute("data-lang");
    applyPrefs();
    renderLibrary();
  });

  /* ---------- reader ---------- */
  var R = { story: -1, lang: "en", rtl: false, flip: null, pages: [], reading: false, W: 0, H: 0 };

  var GLOSS_PER_PAGE = 12;
  var MIN_SCALE = 0.78;  /* never shrink text below this; continue on a new page instead */

  function blankPage(lang, rtl, extra) {
    var pg = el("div", "pg lang-" + lang + (rtl ? " rtl" : " ltr") + (extra ? " " + extra : ""));
    pg.style.position = "relative";
    return pg;
  }

  /* One story page: picture + text. */
  function storyPage(storyIdx, i, lang, rtl) {
    var s = STORIES[storyIdx];
    var L = s.langs[lang];
    var pg = blankPage(lang, rtl, i === 0 ? "cover" : "");
    if (s.scenes[i]) {
      var pic = el("div", "pic");
      pic.appendChild(sceneNode(s.scenes[i]));
      pg.appendChild(pic);
    }
    var text = el("div", "text");
    text.appendChild(frag(L.pages[i]));
    if (i === 0 && L.series) { text.appendChild(el("p", "series", L.series)); }
    pg.appendChild(text);
    return pg;
  }

  /* Word-meaning pages for the Arabic edition, a few words per page. */
  function glossaryPages(storyIdx, lang, rtl) {
    var g = STORIES[storyIdx].langs.ar.glossary || [];
    var parts = Math.ceil(g.length / GLOSS_PER_PAGE);
    var out = [];
    for (var p = 0; p < parts; p++) {
      var pg = blankPage(lang, rtl, "glossary");
      var text = el("div", "text");
      text.appendChild(frag(GLOSS_HEAD));
      if (parts > 1) { text.querySelector("h2").appendChild(document.createTextNode(" (" + digits(p + 1, "ar") + "/" + digits(parts, "ar") + ")")); }
      var list = el("div", "glist");
      g.slice(p * GLOSS_PER_PAGE, (p + 1) * GLOSS_PER_PAGE).forEach(function (item) {
        var row = el("div", "gl");
        row.appendChild(el("span", "w", item.w));
        row.appendChild(el("span", "m", item.m));
        list.appendChild(row);
      });
      text.appendChild(list);
      pg.appendChild(text);
      out.push(pg);
    }
    return out;
  }

  function overflows(text) { return text.scrollHeight > text.clientHeight + 1; }

  /* Shrink text step by step until it fits, but not below minScale. Returns true if it fits. */
  function fitText(pg, base, minScale) {
    var text = pg.querySelector(".text");
    var size = base;
    text.style.fontSize = size + "px";
    var guard = 0;
    while (overflows(text) && size > base * minScale && guard < 80) {
      size *= 0.97;
      text.style.fontSize = size.toFixed(2) + "px";
      guard++;
    }
    return !overflows(text);
  }

  /* Fit a page; if it is too long, move its last paragraphs onto a continuation page.
     Returns the list of pages (one or more) in reading order. */
  function fitOrSplit(pg, base, holder, lang, rtl) {
    if (pg.classList.contains("glossary")) { fitText(pg, base, 0.6); return [pg]; }
    var out = [pg];
    var guard = 0;
    while (guard < 6) {
      guard++;
      var cur = out[out.length - 1];
      if (fitText(cur, base, MIN_SCALE)) { break; }
      var text = cur.querySelector(".text");
      if (text.children.length < 2) { fitText(cur, base, 0.5); break; }
      var cont = blankPage(lang, rtl, "cont");
      var ctext = el("div", "text");
      cont.appendChild(ctext);
      cont.style.width = cur.style.width; cont.style.height = cur.style.height;
      holder.appendChild(cont);
      text.style.fontSize = (base * MIN_SCALE).toFixed(2) + "px";
      while (overflows(text) && text.children.length > 1) {
        ctext.insertBefore(text.lastElementChild, ctext.firstChild);
      }
      fitText(cur, base, MIN_SCALE);
      out.push(cont);
    }
    return out;
  }

  function bookSize() {
    var stage = $("stage");
    var sw = stage.clientWidth - 16, sh = stage.clientHeight - 10;
    var ratio = 1.5;
    var w = Math.min(sw, 560);
    var h = w * ratio;
    if (h > sh) { h = sh; w = h / ratio; }
    return { W: Math.floor(w), H: Math.floor(h) };
  }

  function openBook(storyIdx, startLogical) {
    TTS.stop();
    R.story = storyIdx;
    R.lang = prefs.lang;
    R.rtl = R.lang === "ar";
    R.reading = false;
    $("library").hidden = true;
    $("exercise").hidden = true;
    $("reader").hidden = false;
    $("reader").className = "screen lang-" + R.lang;
    $("r-title").textContent = STORIES[storyIdx].langs[R.lang].title;
    $("r-ex").hidden = R.lang !== "ar";
    $("r-auto").setAttribute("aria-pressed", prefs.auto ? "true" : "false");
    $("r-auto").classList.toggle("on", !!prefs.auto);
    setPlayIcon(false);
    fontsReady().then(function () { buildBook(startLogical || 0); });
  }

  function buildBook(startLogical) {
    if (R.flip) { try { R.flip.destroy(); } catch (e) { /* ignore */ } R.flip = null; }
    var stage = $("stage");
    stage.replaceChildren();
    var book = el("div");
    book.id = "book";
    stage.appendChild(book);

    var sz = bookSize();
    R.W = sz.W; R.H = sz.H;
    var L = STORIES[R.story].langs[R.lang];
    var base = R.W / (R.lang === "ar" ? 18.5 : R.lang === "bn" ? 21 : 22);

    /* build and fit every page off-screen first */
    var measure = el("div");
    measure.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;";
    document.body.appendChild(measure);
    var raw = [];
    for (var i = 0; i < L.pages.length; i++) { raw.push(storyPage(R.story, i, R.lang, R.rtl)); }
    if (R.lang === "ar") { raw = raw.concat(glossaryPages(R.story, R.lang, R.rtl)); }
    var pages = [];
    for (var j = 0; j < raw.length; j++) {
      var pg = raw[j];
      pg.style.width = R.W + "px";
      pg.style.height = R.H + "px";
      measure.appendChild(pg);
      pages = pages.concat(fitOrSplit(pg, base, measure, R.lang, R.rtl));
    }
    for (var q = 1; q < pages.length; q++) { pages[q].appendChild(el("div", "pno", digits(q + 1, R.lang))); }
    var n = pages.length;
    if (startLogical > n - 1) { startLogical = n - 1; }
    if (R.rtl) { pages.reverse(); }
    for (var k = 0; k < pages.length; k++) { pages[k].style.width = ""; pages[k].style.height = ""; book.appendChild(pages[k]); }
    measure.parentNode.removeChild(measure);
    R.pages = pages;

    book.style.width = R.W + "px";
    book.style.height = R.H + "px";
    var startPhysical = R.rtl ? n - 1 - startLogical : startLogical;
    R.flip = new St.PageFlip(book, {
      width: R.W, height: R.H, size: "fixed", usePortrait: true, showCover: false,
      autoSize: false, drawShadow: true, maxShadowOpacity: 0.45, flippingTime: 650,
      mobileScrollSupport: false, startPage: startPhysical, swipeDistance: 24, showPageCorners: true
    });
    R.flip.loadFromHTML(pages);
    R.flip.on("flip", function () { onPageChanged(true); });
    onPageChanged(false);
  }

  function physIndex() { return R.flip ? R.flip.getCurrentPageIndex() : 0; }
  function logicalIndex() { var n = R.pages.length; return R.rtl ? n - 1 - physIndex() : physIndex(); }
  function currentText() { var p = R.pages[physIndex()]; return p ? p.querySelector(".text") : null; }

  function onPageChanged(fromFlip) {
    var n = R.pages.length;
    var idx = physIndex();
    $("r-pnum").textContent = digits(logicalIndex() + 1, R.lang) + " / " + digits(n, R.lang);
    $("r-left").disabled = idx <= 0;
    $("r-right").disabled = idx >= n - 1;
    if (fromFlip && R.reading) { setTimeout(readCurrentPage, 250); }
  }

  function hasNextLogical() { return R.rtl ? physIndex() > 0 : physIndex() < R.pages.length - 1; }
  function turnNextLogical() { if (R.rtl) { R.flip.flipPrev("top"); } else { R.flip.flipNext("top"); } }

  function setPlayIcon(on) {
    var use = $("r-play").querySelector("use");
    use.setAttribute("href", on ? "#i-stop" : "#i-play");
    $("r-play").setAttribute("aria-label", on ? "Stop reading" : "Read aloud");
  }

  function readCurrentPage() {
    if (!R.reading) { return; }
    var segs = TTS.segmentsForPage(currentText(), R.lang);
    if (!segs.length) { afterPageRead(); return; }
    TTS.play(segs, afterPageRead);
  }
  function afterPageRead() {
    if (!R.reading) { return; }
    if (prefs.auto && hasNextLogical()) {
      setTimeout(function () { if (R.reading) { turnNextLogical(); } }, 500);
    } else {
      stopReading();
    }
  }
  function startReading() { R.reading = true; setPlayIcon(true); readCurrentPage(); }
  function stopReading() { R.reading = false; TTS.stop(); setPlayIcon(false); }

  $("r-play").addEventListener("click", function () { if (R.reading) { stopReading(); } else { startReading(); } });
  $("r-left").addEventListener("click", function () { if (R.flip) { R.flip.flipPrev("top"); } });
  $("r-right").addEventListener("click", function () { if (R.flip) { R.flip.flipNext("top"); } });
  $("r-auto").addEventListener("click", function () {
    prefs.auto = !prefs.auto; applyPrefs();
    this.setAttribute("aria-pressed", prefs.auto ? "true" : "false");
    this.classList.toggle("on", prefs.auto);
  });
  $("r-back").addEventListener("click", closeReader);
  $("r-ex").addEventListener("click", function () { stopReading(); openExercise(R.story, "reader"); });

  function closeReader() {
    stopReading();
    if (R.flip) { try { R.flip.destroy(); } catch (e) { /* ignore */ } R.flip = null; }
    $("reader").hidden = true;
    $("library").hidden = false;
    R.story = -1;
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if ($("reader").hidden || R.story < 0) { return; }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var keep = logicalIndex();
      var wasReading = R.reading;
      stopReading();
      buildBook(keep);
      if (wasReading) { startReading(); }
    }, 250);
  });

  /* ---------- Arabic exercises ---------- */
  var X = { story: -1, from: "library", mode: "meaning", qs: [], at: 0, results: [], answered: false, hide: false };

  function openExercise(storyIdx, from) {
    TTS.stop();
    X.story = storyIdx; X.from = from || "library";
    $("reader").hidden = true;
    $("library").hidden = true;
    $("exercise").hidden = false;
    $("x-title").textContent = "تَمَارِينُ · " + STORIES[storyIdx].langs.ar.title;
    setMode(X.mode);
  }
  function closeExercise() {
    TTS.stop();
    $("exercise").hidden = true;
    if (X.from === "reader" && R.story >= 0) { $("reader").hidden = false; } else { $("library").hidden = false; }
  }
  $("x-back").addEventListener("click", closeExercise);

  function setMode(mode) {
    X.mode = mode;
    var tabs = document.querySelectorAll(".tabs button");
    for (var i = 0; i < tabs.length; i++) { tabs[i].setAttribute("aria-pressed", tabs[i].getAttribute("data-mode") === mode ? "true" : "false"); }
    if (mode === "list") { renderList(); } else { newQuiz(); }
  }
  document.querySelector(".tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) { TTS.stop(); setMode(b.getAttribute("data-mode")); }
  });

  function gloss() { return STORIES[X.story].langs.ar.glossary; }

  function newQuiz() {
    var g = gloss();
    var order = shuffle(g.map(function (_, i) { return i; })).slice(0, Math.min(10, g.length));
    X.qs = order.map(function (ix) {
      var others = shuffle(g.map(function (_, i) { return i; }).filter(function (j) {
        return j !== ix && g[j].m !== g[ix].m && g[j].w !== g[ix].w;
      })).slice(0, 3);
      return { ix: ix, opts: shuffle([ix].concat(others)) };
    });
    X.at = 0; X.results = []; X.answered = false;
    renderQuestion();
  }

  function sayBtn(word) {
    var b = el("button", "say-btn");
    b.appendChild(frag("<svg class=\"ic\" style=\"width:18px;height:18px\"><use href=\"#i-sound\"/></svg>"));
    b.appendChild(document.createTextNode(" اسْتَمِعْ · Listen"));
    b.addEventListener("click", function () { TTS.say(word, "ar"); });
    var row = el("div", "center"); row.appendChild(b);
    return row;
  }

  function renderQuestion() {
    var panel = $("x-panel");
    panel.replaceChildren();
    var g = gloss();
    var q = X.qs[X.at];
    var item = g[q.ix];

    var top = el("div", "q-top");
    var dots = el("div", "dots");
    for (var d = 0; d < X.qs.length; d++) {
      var dot = el("i");
      if (d < X.results.length) { dot.className = X.results[d] ? "ok" : "no"; } else if (d === X.at) { dot.className = "now"; }
      dots.appendChild(dot);
    }
    top.appendChild(el("span", null, (X.at + 1) + " / " + X.qs.length));
    top.appendChild(dots);
    panel.appendChild(top);

    if (X.mode === "meaning") {
      panel.appendChild(el("div", "q-word", item.w));
      panel.appendChild(sayBtn(item.w));
      panel.appendChild(el("div", "q-hint", "مَا مَعْنَى هَٰذِهِ الْكَلِمَةِ؟ · What does this word mean?"));
    } else {
      panel.appendChild(el("div", "q-mean", item.m));
      panel.appendChild(el("div", "q-hint", "اخْتَرِ الْكَلِمَةَ الصَّحِيحَةَ · Choose the right Arabic word"));
    }

    var opts = el("div", "opts");
    q.opts.forEach(function (oi) {
      var btn = el("button", "opt" + (X.mode === "word" ? " arw" : ""), X.mode === "meaning" ? g[oi].m : g[oi].w);
      btn.addEventListener("click", function () { answer(btn, oi, q, opts); });
      opts.appendChild(btn);
    });
    panel.appendChild(opts);
    var fb = el("div", "feedback"); fb.id = "x-fb";
    panel.appendChild(fb);
    var nextRow = el("div", "next-row"); nextRow.id = "x-next"; nextRow.hidden = true;
    var nb = el("button", "big-btn", X.at + 1 < X.qs.length ? "التَّالِي · Next" : "النَّتِيجَةُ · See score");
    nb.addEventListener("click", function () { X.at++; X.answered = false; if (X.at < X.qs.length) { renderQuestion(); } else { renderResult(); } });
    nextRow.appendChild(nb);
    panel.appendChild(nextRow);
    X.answered = false;
  }

  function answer(btn, oi, q, opts) {
    if (X.answered) { return; }
    X.answered = true;
    var g = gloss();
    var ok = oi === q.ix;
    X.results.push(ok);
    var all = opts.querySelectorAll(".opt");
    for (var i = 0; i < all.length; i++) {
      if (q.opts[i] === q.ix) { all[i].classList.add("right"); }
    }
    if (!ok) { btn.classList.add("wrong"); }
    var fb = $("x-fb");
    fb.className = "feedback " + (ok ? "ok" : "no");
    fb.textContent = ok ? "أَحْسَنْتَ! · Well done!" : "الْجَوَابُ الصَّحِيحُ بِالْأَخْضَرِ · The right answer is in green";
    TTS.say(g[q.ix].w, "ar");
    $("x-next").hidden = false;
  }

  function renderResult() {
    var panel = $("x-panel");
    panel.replaceChildren();
    var score = X.results.filter(Boolean).length, total = X.results.length;
    var key = "best-" + STORIES[X.story].key + "-" + X.mode;
    var best = Math.max(load(key, 0), score);
    store(key, best);
    var stars = score >= total - 1 ? 3 : score >= Math.ceil(total * 0.6) ? 2 : 1;
    var box = el("div", "result");
    box.appendChild(el("div", "stars", "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars)));
    box.appendChild(el("div", "score", score + " / " + total));
    box.appendChild(el("p", null, stars === 3 ? "مُمْتَازٌ! · Excellent!" : stars === 2 ? "جَيِّدٌ جِدًّا! · Very good!" : "حَاوِلْ مَرَّةً أُخْرَى · Keep practising!"));
    box.appendChild(el("p", null, "أَفْضَلُ نَتِيجَةٍ · Best: " + best + " / " + total));
    var again = el("button", "big-btn", "أَعِدِ التَّمْرِينَ · Try again");
    again.addEventListener("click", newQuiz);
    var row = el("div", "next-row"); row.appendChild(again);
    box.appendChild(row);
    panel.appendChild(box);
  }

  function renderList() {
    var panel = $("x-panel");
    panel.replaceChildren();
    var tools = el("div", "wl-tools");
    tools.appendChild(el("span", "q-hint", "اضْغَطْ عَلَى الْكَلِمَةِ لِتَسْمَعَهَا · Tap a word to hear it"));
    var hide = el("button", "chip", X.hide ? "أَظْهِرِ الْمَعَانِيَ · Show meanings" : "أَخْفِ الْمَعَانِيَ · Hide meanings");
    hide.addEventListener("click", function () { X.hide = !X.hide; renderList(); });
    tools.appendChild(hide);
    panel.appendChild(tools);
    var grid = el("div", "wl");
    gloss().forEach(function (item) {
      var c = el("button", "wcard" + (X.hide ? " hide" : ""));
      c.appendChild(el("div", "w", item.w));
      c.appendChild(el("div", "m", item.m));
      c.addEventListener("click", function () { c.classList.remove("hide"); TTS.say(item.w, "ar"); });
      grid.appendChild(c);
    });
    panel.appendChild(grid);
  }

  /* ---------- settings sheet ---------- */
  function openSettings() {
    $("s-eng-device").checked = prefs.engine !== "cloud";
    $("s-eng-cloud").checked = prefs.engine === "cloud";
    $("s-key").value = prefs.apiKey || "";
    $("s-voice-ar").value = prefs.voices.ar || "";
    $("s-voice-bn").value = prefs.voices.bn || "";
    $("s-voice-en").value = prefs.voices.en || "";
    $("s-rate").value = prefs.rate;
    $("s-rate-val").textContent = "× " + Number(prefs.rate).toFixed(2);
    $("s-auto").checked = !!prefs.auto;
    showStatus();
    $("settings").hidden = false;
  }
  function closeSettings() { saveSettings(); $("settings").hidden = true; TTS.stop(); }
  function saveSettings() {
    prefs.engine = $("s-eng-cloud").checked ? "cloud" : "device";
    prefs.apiKey = $("s-key").value.trim();
    prefs.voices = { ar: $("s-voice-ar").value.trim(), bn: $("s-voice-bn").value.trim(), en: $("s-voice-en").value.trim() };
    prefs.rate = parseFloat($("s-rate").value) || 0.9;
    prefs.auto = $("s-auto").checked;
    applyPrefs();
    $("s-rate-val").textContent = "× " + prefs.rate.toFixed(2);
  }
  function showStatus(extra) {
    var e = TTS.engineLabel();
    var msg = e === "device" ? "Using the phone's Google Text-to-Speech engine." :
              e === "cloud" ? "Using Google Cloud Text-to-Speech." :
              e === "browser" ? "Using this browser's voices (preview mode)." : "No voice engine found.";
    if (prefs.engine === "cloud" && !prefs.apiKey) { msg += " Add an API key to use Google Cloud."; }
    if (TTS.lastError) { msg += " Last error: " + TTS.lastError; }
    if (extra) { msg += " " + extra; }
    $("s-status").textContent = msg;
  }
  $("open-settings").addEventListener("click", openSettings);
  $("s-android").hidden = !TTS.hasBridge();
  $("s-android").addEventListener("click", function () {
    try { window.AndroidTTS.openSettings(); } catch (e) { showStatus("Could not open the phone settings."); }
  });
  $("s-close").addEventListener("click", closeSettings);
  $("s-done").addEventListener("click", closeSettings);
  $("settings").addEventListener("click", function (e) { if (e.target === this) { closeSettings(); } });
  ["s-eng-device", "s-eng-cloud", "s-key", "s-voice-ar", "s-voice-bn", "s-voice-en", "s-rate", "s-auto"].forEach(function (id) {
    $(id).addEventListener("change", function () { saveSettings(); showStatus(); });
    $(id).addEventListener("input", function () { if (id === "s-rate") { $("s-rate-val").textContent = "× " + Number(this.value).toFixed(2); } });
  });
  document.querySelector(".tests").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-test]");
    if (!b) { return; }
    saveSettings();
    TTS.lastError = "";
    var lang = b.getAttribute("data-test");
    TTS.say(TEST_LINES[lang], lang, function () { showStatus(); });
    showStatus();
  });

  /* ---------- Android back button ---------- */
  window.appBack = function () {
    if (!$("settings").hidden) { closeSettings(); return true; }
    if (!$("exercise").hidden) { closeExercise(); return true; }
    if (!$("reader").hidden) { closeReader(); return true; }
    return false;
  };
  /* stop speech when the app goes to the background */
  document.addEventListener("visibilitychange", function () { if (document.hidden && R.reading) { stopReading(); } });

  renderLibrary();
  window.StoryApp = { openBook: openBook, openExercise: openExercise, reader: R, exercise: X };
})();
