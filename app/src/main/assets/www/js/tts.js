/* Read-aloud for the storybooks.
 *
 * Three ways to speak, in order of preference:
 *  1. "device": the phone's own Google Text-to-Speech engine, through the Android bridge
 *     (window.AndroidTTS, added by MainActivity). Works offline once voices are installed.
 *  2. "cloud": Google Cloud Text-to-Speech REST API, when the user saves an API key.
 *     Natural voices; needs internet; audio is cached on the phone after the first play.
 *  3. Web Speech API, used automatically when the page runs in a normal browser.
 *
 * Text is read as a queue of segments [{text, lang, el}] so that Arabic phrases inside
 * English or Bangla pages are read with an Arabic voice.
 */
(function () {
  "use strict";

  var LANG_TAGS = { en: "en-US", ar: "ar-SA", bn: "bn-BD" };
  var CLOUD_LANG = { en: "en-GB", ar: "ar-XA", bn: "bn-IN" };

  var settings = { engine: "device", apiKey: "", rate: 0.9, voices: { en: "", ar: "", bn: "" }, deviceVoices: { en: "", ar: "", bn: "" } };
  /* Google's most natural Cloud voices (Chirp 3 HD), used when no voice name is given. */
  var CLOUD_DEFAULT = { en: "en-GB-Chirp3-HD-Kore", ar: "ar-XA-Chirp3-HD-Kore", bn: "bn-IN-Chirp3-HD-Kore" };
  var cloudDefaultFailed = {};
  var queue = [];
  var current = null;
  var runId = 0;
  var callbacks = {};
  var audioEl = null;
  var nextUtteranceId = 1;

  function hasBridge() {
    return typeof window.AndroidTTS !== "undefined" && window.AndroidTTS !== null;
  }

  function hasWebSpeech() {
    return typeof window.speechSynthesis !== "undefined";
  }

  /* ---------- Android bridge callbacks (called from Java) ---------- */
  window.TTS_onDone = function (id) { finishUtterance(String(id), true); };
  window.TTS_onError = function (id) { finishUtterance(String(id), false); };

  var pendingNative = {};
  function finishUtterance(id, ok) {
    var cb = pendingNative[id];
    if (cb) { delete pendingNative[id]; cb(ok); }
  }

  /* ---------- engines ---------- */
  function speakDevice(seg, done) {
    if (hasBridge()) {
      var id = "u" + (nextUtteranceId++);
      pendingNative[id] = done;
      var ok = false;
      try { ok = window.AndroidTTS.speak(id, seg.text, LANG_TAGS[seg.lang] || "en-US", settings.rate); } catch (e) { ok = false; }
      if (!ok) { delete pendingNative[id]; done(false); }
      return;
    }
    if (hasWebSpeech()) {
      var u = new SpeechSynthesisUtterance(seg.text);
      u.lang = LANG_TAGS[seg.lang] || "en-US";
      u.rate = settings.rate;
      var pick = pickWebVoice(u.lang);
      if (pick) { u.voice = pick; }
      var finished = false;
      var end = function (ok) { if (!finished) { finished = true; done(ok); } };
      u.onend = function () { end(true); };
      u.onerror = function () { end(false); };
      window.speechSynthesis.speak(u);
      return;
    }
    done(false);
  }

  function pickWebVoice(tag) {
    if (!hasWebSpeech()) { return null; }
    var list = window.speechSynthesis.getVoices() || [];
    var base = tag.split("-")[0];
    var exact = null, partial = null;
    for (var i = 0; i < list.length; i++) {
      var l = (list[i].lang || "").replace("_", "-");
      if (l === tag) { exact = exact || list[i]; }
      if (l.split("-")[0] === base) { partial = partial || list[i]; }
    }
    return exact || partial;
  }

  /* Small IndexedDB cache so Cloud audio is fetched only once. */
  var dbPromise = null;
  function openDb() {
    if (dbPromise) { return dbPromise; }
    dbPromise = new Promise(function (resolve) {
      try {
        var req = window.indexedDB.open("story-tts", 1);
        req.onupgradeneeded = function () { req.result.createObjectStore("audio"); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbPromise;
  }
  function cacheGet(key) {
    return openDb().then(function (db) {
      if (!db) { return null; }
      return new Promise(function (resolve) {
        try {
          var r = db.transaction("audio").objectStore("audio").get(key);
          r.onsuccess = function () { resolve(r.result || null); };
          r.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function cachePut(key, val) {
    openDb().then(function (db) {
      if (!db) { return; }
      try { db.transaction("audio", "readwrite").objectStore("audio").put(val, key); } catch (e) { /* ignore */ }
    });
  }

  function cloudVoiceFor(lang) {
    var v = { languageCode: CLOUD_LANG[lang] || "en-GB", ssmlGender: "FEMALE" };
    var name = (settings.voices && settings.voices[lang]) || "";
    if (!name && !cloudDefaultFailed[lang]) { name = CLOUD_DEFAULT[lang] || ""; }
    if (name) { v.name = name; v.languageCode = name.split("-").slice(0, 2).join("-"); delete v.ssmlGender; }
    return v;
  }

  function speakCloud(seg, done) {
    if (!settings.apiKey) { speakDevice(seg, done); return; }
    var voice = cloudVoiceFor(seg.lang);
    var key = [voice.name || voice.languageCode, settings.rate, seg.text].join("|");
    cacheGet(key).then(function (b64) {
      if (b64) { playB64(b64, done); return; }
      var body = {
        input: { text: seg.text },
        voice: voice,
        audioConfig: { audioEncoding: "MP3", speakingRate: settings.rate }
      };
      fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + encodeURIComponent(settings.apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok && r.status === 400 && voice.name === CLOUD_DEFAULT[seg.lang]) {
          /* the newest voices are not available for this key: use a standard Google voice */
          cloudDefaultFailed[seg.lang] = true;
          throw { retry: true };
        }
        if (!r.ok) { throw new Error("Cloud TTS error " + r.status); }
        return r.json();
      }).then(function (j) {
        if (!j.audioContent) { throw new Error("No audio"); }
        cachePut(key, j.audioContent);
        playB64(j.audioContent, done);
      }).catch(function (err) {
        if (err && err.retry) { speakCloud(seg, done); return; }
        if (window.console) { console.warn(err); }
        TTS.lastError = String(err && err.message ? err.message : err);
        speakDevice(seg, done); /* fall back to the phone voice */
      });
    });
  }

  function playB64(b64, done) {
    if (!audioEl) { audioEl = new Audio(); }
    var finished = false;
    var end = function (ok) { if (!finished) { finished = true; done(ok); } };
    audioEl.onended = function () { end(true); };
    audioEl.onerror = function () { end(false); };
    audioEl.src = "data:audio/mp3;base64," + b64;
    var p = audioEl.play();
    if (p && p.catch) { p.catch(function () { end(false); }); }
  }

  /* ---------- queue ---------- */
  function step(myRun) {
    if (myRun !== runId) { return; }
    if (current && current.el) { current.el.classList.remove("reading"); }
    if (!queue.length) {
      current = null;
      var cb = callbacks.onEnd; callbacks = {};
      if (cb) { cb(); }
      return;
    }
    current = queue.shift();
    if (current.el) { current.el.classList.add("reading"); }
    var engine = settings.engine === "cloud" ? speakCloud : speakDevice;
    engine(current, function () {
      /* small natural pause between segments */
      setTimeout(function () { step(myRun); }, current && current.pause ? current.pause : 120);
    });
  }

  var TTS = {
    lastError: "",
    configure: function (s) {
      for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) { settings[k] = s[k]; } }
      if (hasBridge() && typeof window.AndroidTTS.setPreferredVoice === "function") {
        ["en", "ar", "bn"].forEach(function (l) {
          try { window.AndroidTTS.setPreferredVoice(LANG_TAGS[l], (settings.deviceVoices && settings.deviceVoices[l]) || ""); } catch (e) { /* ignore */ }
        });
      }
    },
    /* The phone's voices for a language: [{name, online, quality, country}], best first. */
    deviceVoiceList: function (lang) {
      if (!hasBridge() || typeof window.AndroidTTS.listVoices !== "function") { return []; }
      var list = [];
      try { list = JSON.parse(window.AndroidTTS.listVoices(LANG_TAGS[lang] || "en-US")) || []; } catch (e) { list = []; }
      list.sort(function (a, b) {
        var sa = (a.quality || 0) + (a.online ? 150 : 0), sb = (b.quality || 0) + (b.online ? 150 : 0);
        return sb - sa || String(a.name).localeCompare(String(b.name));
      });
      return list;
    },
    settings: function () { return settings; },
    play: function (segments, onEnd) {
      TTS.stop();
      runId++;
      queue = segments.slice();
      callbacks = { onEnd: onEnd };
      step(runId);
    },
    stop: function () {
      runId++;
      queue = [];
      callbacks = {};
      if (current && current.el) { current.el.classList.remove("reading"); }
      current = null;
      pendingNative = {};
      if (hasBridge()) { try { window.AndroidTTS.stop(); } catch (e) { /* ignore */ } }
      if (hasWebSpeech()) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
      if (audioEl) { try { audioEl.pause(); } catch (e) { /* ignore */ } }
    },
    isSpeaking: function () { return current !== null; },
    say: function (text, lang, onEnd) {
      TTS.play([{ text: text, lang: lang, el: null }], onEnd);
    },
    engineLabel: function () {
      if (settings.engine === "cloud" && settings.apiKey) { return "cloud"; }
      if (hasBridge()) { return "device"; }
      if (hasWebSpeech()) { return "browser"; }
      return "none";
    },
    hasBridge: hasBridge
  };

  /* ---------- turning a page into speakable segments ---------- */
  var AR_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  var LETTER = /[A-Za-zঀ-৿؀-ۿݐ-ݿﭐ-ﷹﹰ-﻿0-9]/;
  var SALAWAT = { en: "peace be upon him", bn: "সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম", ar: "صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ" };

  function splitByScript(text, baseLang) {
    if (baseLang === "ar") { return [{ text: text, lang: "ar" }]; }
    var out = [];
    var buf = "", bufAr = null;
    var words = text.split(/(\s+)/);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (/^\s+$/.test(w) || w === "") { buf += w; continue; }
      var isAr = AR_CHARS.test(w);
      if (bufAr === null) { bufAr = isAr; }
      if (isAr !== bufAr && LETTER.test(w)) {
        out.push({ text: buf, lang: bufAr ? "ar" : baseLang });
        buf = ""; bufAr = isAr;
      }
      buf += w;
    }
    if (buf) { out.push({ text: buf, lang: bufAr ? "ar" : baseLang }); }
    var clean = [];
    for (var j = 0; j < out.length; j++) {
      var t = out[j].text.replace(/[«»“”"()\[\]﴿﴾]/g, " ").replace(/\s+/g, " ").trim();
      if (t && LETTER.test(t)) { clean.push({ text: t, lang: out[j].lang }); }
    }
    return clean;
  }

  function blockText(el, lang) {
    var clone = el.cloneNode(true);
    var drop = clone.querySelectorAll(".ref, .qref, .num");
    for (var i = 0; i < drop.length; i++) { drop[i].parentNode.removeChild(drop[i]); }
    var t = clone.textContent || "";
    t = t.replace(/ﷺ/g, " " + SALAWAT[lang] + " ");
    return t.replace(/\s+/g, " ").trim();
  }

  /* Build the reading queue for one page's text element. */
  TTS.segmentsForPage = function (textEl, lang) {
    var segs = [];
    if (!textEl) { return segs; }
    var gl = textEl.querySelectorAll(".gl");
    if (gl.length) {
      var head = textEl.querySelector("h2");
      if (head) { segs.push({ text: blockText(head, "ar"), lang: "ar", el: head, pause: 400 }); }
      for (var g = 0; g < gl.length; g++) {
        var w = gl[g].querySelector(".w"), m = gl[g].querySelector(".m");
        if (w) { segs.push({ text: blockText(w, "ar"), lang: "ar", el: gl[g], pause: 150 }); }
        if (m) { segs.push({ text: blockText(m, "en"), lang: "en", el: gl[g], pause: 450 }); }
      }
      return segs;
    }
    var blocks = textEl.querySelectorAll("h1, h2, p, li");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.classList.contains("note") || b.classList.contains("en") || b.classList.contains("en-sub")) { continue; }
      if (b.tagName === "P" && b.parentNode && b.parentNode.tagName === "LI") { continue; }
      var txt = blockText(b, lang);
      if (!txt) { continue; }
      var parts = splitByScript(txt, lang);
      for (var k = 0; k < parts.length; k++) {
        segs.push({ text: parts[k].text, lang: parts[k].lang, el: b, pause: k === parts.length - 1 ? 380 : 140 });
      }
    }
    return segs;
  };

  window.TTS = TTS;
})();
