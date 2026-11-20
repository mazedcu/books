package com.radon.storybooks;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * JavaScript bridge to the phone's text-to-speech engine (Google Speech Services when
 * installed). The web app sends one sentence at a time with speak(); when it finishes,
 * this class calls window.TTS_onDone(id) in the page so the next sentence can be read.
 *
 * To sound as natural as possible, each language is read with the best voice the engine
 * offers: Google's higher-quality online voices when there is internet, otherwise the best
 * installed offline voice. The reader can also choose a voice in the app's settings.
 */
public class TtsBridge {

    private static final String GOOGLE_TTS = "com.google.android.tts";
    /** After a network voice fails, use offline voices for this long. */
    private static final long NETWORK_BACKOFF_MS = 60_000L;

    private final Context context;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<String[]> waiting = new ArrayList<>();
    private final Map<String, String> preferred = new HashMap<>();   // language -> voice name
    private final Map<String, String[]> spoken = new HashMap<>();    // utterance id -> request
    private final Map<String, Boolean> usedNetwork = new HashMap<>(); // utterance id -> network voice?
    private TextToSpeech tts;
    private volatile boolean ready = false;
    private volatile long networkFailedAt = 0L;

    public TtsBridge(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
        // Ask for Google's engine; Android falls back to the default engine if it is missing.
        tts = new TextToSpeech(this.context, status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { forget(id); callJs("TTS_onDone", id); }
                    @Override @SuppressWarnings("deprecation") public void onError(String id) { failed(id, TextToSpeech.ERROR); }
                    @Override public void onError(String id, int code) { failed(id, code); }
                    @Override public void onStop(String id, boolean interrupted) { forget(id); }
                });
                List<String[]> pending;
                synchronized (waiting) {
                    pending = new ArrayList<>(waiting);
                    waiting.clear();
                }
                for (String[] w : pending) {
                    speakNow(w[0], w[1], w[2], Float.parseFloat(w[3]));
                }
            } else {
                failWaiting();
            }
        }, GOOGLE_TTS);
    }

    /** Speak one piece of text. lang is a tag such as "ar-SA", "bn-BD" or "en-US". */
    @JavascriptInterface
    public boolean speak(String id, String text, String lang, float rate) {
        if (!ready) {
            synchronized (waiting) {
                waiting.add(new String[]{id, text, lang, String.valueOf(rate)});
            }
            return true;
        }
        return speakNow(id, text, lang, rate);
    }

    private synchronized boolean speakNow(String id, String text, String lang, float rate) {
        Voice voice = bestVoice(lang);
        boolean ok = false;
        if (voice != null) {
            ok = tts.setVoice(voice) == TextToSpeech.SUCCESS;
        }
        if (!ok && !setLanguage(lang)) {
            callJs("TTS_onError", id);
            return true;
        }
        tts.setSpeechRate(rate > 0 ? rate : 1.0f);
        tts.setPitch(1.0f);
        synchronized (spoken) {
            spoken.put(id, new String[]{text, lang, String.valueOf(rate)});
            usedNetwork.put(id, ok && voice.isNetworkConnectionRequired());
        }
        int result = tts.speak(text, TextToSpeech.QUEUE_ADD, new Bundle(), id);
        if (result != TextToSpeech.SUCCESS) {
            forget(id);
            callJs("TTS_onError", id);
        }
        return true;
    }

    /** If an online voice fails (for example the internet dropped), read the same text offline. */
    private void failed(String id, int code) {
        String[] req;
        boolean wasNetwork;
        synchronized (spoken) {
            req = spoken.remove(id);
            Boolean n = usedNetwork.remove(id);
            wasNetwork = n != null && n;
        }
        if (req != null && wasNetwork) {
            networkFailedAt = System.currentTimeMillis();
            final String[] r = req;
            main.post(() -> speakNow(id, r[0], r[1], Float.parseFloat(r[2])));
            return;
        }
        callJs("TTS_onError", id);
    }

    private void forget(String id) {
        synchronized (spoken) {
            spoken.remove(id);
            usedNetwork.remove(id);
        }
    }

    /**
     * The most natural voice for this language: the reader's own choice if set, otherwise the
     * highest-quality voice, preferring Google's online voices while the internet works.
     */
    private Voice bestVoice(String tag) {
        Set<Voice> all;
        try {
            all = tts.getVoices();
        } catch (RuntimeException e) {
            return null;
        }
        if (all == null || all.isEmpty()) {
            return null;
        }
        Locale want = Locale.forLanguageTag(tag);
        String lang = want.getLanguage();
        String pref = preferred.get(lang);
        boolean netOk = isOnline() && System.currentTimeMillis() - networkFailedAt > NETWORK_BACKOFF_MS;
        Voice best = null;
        int bestScore = Integer.MIN_VALUE;
        for (Voice v : all) {
            if (!usable(v, lang)) {
                continue;
            }
            boolean net = v.isNetworkConnectionRequired();
            if (net && !netOk) {
                continue;
            }
            if (pref != null && !pref.isEmpty() && pref.equals(v.getName())) {
                return v;
            }
            int score = v.getQuality();
            if (net) {
                score += 150;
            }
            if (!want.getCountry().isEmpty() && want.getCountry().equals(v.getLocale().getCountry())) {
                score += 40;
            }
            if (score > bestScore) {
                bestScore = score;
                best = v;
            }
        }
        return best;
    }

    private static boolean usable(Voice v, String lang) {
        if (v == null || v.getLocale() == null || !lang.equals(v.getLocale().getLanguage())) {
            return false;
        }
        Set<String> f = v.getFeatures();
        return f == null || !f.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) {
                return false;
            }
            Network n = cm.getActiveNetwork();
            NetworkCapabilities caps = n == null ? null : cm.getNetworkCapabilities(n);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (RuntimeException e) {
            return false;
        }
    }

    private boolean setLanguage(String tag) {
        Locale locale = Locale.forLanguageTag(tag);
        int r = tts.setLanguage(locale);
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            // try the language without the country, e.g. "ar" or "bn"
            r = tts.setLanguage(new Locale(locale.getLanguage()));
        }
        if ((r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) && "bn".equals(locale.getLanguage())) {
            r = tts.setLanguage(new Locale("bn", "IN"));
        }
        return r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
    }

    /** Voices the reader can choose from for a language, as JSON: [{name, online, quality, country}]. */
    @JavascriptInterface
    public String listVoices(String tag) {
        JSONArray out = new JSONArray();
        if (!ready) {
            return out.toString();
        }
        try {
            String lang = Locale.forLanguageTag(tag).getLanguage();
            Set<Voice> all = tts.getVoices();
            if (all != null) {
                for (Voice v : all) {
                    if (!usable(v, lang)) {
                        continue;
                    }
                    JSONObject o = new JSONObject();
                    o.put("name", v.getName());
                    o.put("online", v.isNetworkConnectionRequired());
                    o.put("quality", v.getQuality());
                    o.put("country", v.getLocale().getCountry());
                    out.put(o);
                }
            }
        } catch (Exception e) {
            // return what we have
        }
        return out.toString();
    }

    /** The reader's chosen voice for a language ("" means choose automatically). */
    @JavascriptInterface
    public void setPreferredVoice(String lang, String name) {
        String key = Locale.forLanguageTag(lang).getLanguage();
        if (name == null || name.isEmpty()) {
            preferred.remove(key);
        } else {
            preferred.put(key, name);
        }
    }

    @JavascriptInterface
    public boolean isLanguageAvailable(String tag) {
        if (!ready) {
            return false;
        }
        int r = tts.isLanguageAvailable(Locale.forLanguageTag(tag));
        return r >= TextToSpeech.LANG_AVAILABLE;
    }

    @JavascriptInterface
    public void stop() {
        synchronized (waiting) {
            waiting.clear();
        }
        synchronized (spoken) {
            spoken.clear();
            usedNetwork.clear();
        }
        if (tts != null && ready) {
            tts.stop();
        }
    }

    /** Opens Android's text-to-speech settings, where voices can be downloaded. */
    @JavascriptInterface
    public void openSettings() {
        main.post(() -> {
            Intent i = new Intent("com.android.settings.TTS_SETTINGS");
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                context.startActivity(i);
            } catch (ActivityNotFoundException e) {
                Intent install = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(install);
                } catch (ActivityNotFoundException ignored) {
                    // nothing else to try
                }
            }
        });
    }

    public void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        ready = false;
    }

    private void failWaiting() {
        List<String[]> pending;
        synchronized (waiting) {
            pending = new ArrayList<>(waiting);
            waiting.clear();
        }
        for (String[] w : pending) {
            callJs("TTS_onError", w[0]);
        }
    }

    private void callJs(final String fn, final String id) {
        // ids are created by the app ("u123"), but keep only safe characters anyway
        final String safe = id == null ? "" : id.replaceAll("[^A-Za-z0-9_-]", "");
        main.post(() -> webView.evaluateJavascript(
                "window." + fn + " && window." + fn + "('" + safe + "')", null));
    }
}
