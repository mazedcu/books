package com.radon.storybooks;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * JavaScript bridge to the phone's text-to-speech engine (Google Speech Services when
 * installed). The web app sends one sentence at a time with speak(); when it finishes,
 * this class calls window.TTS_onDone(id) in the page so the next sentence can be read.
 */
public class TtsBridge {

    private static final String GOOGLE_TTS = "com.google.android.tts";

    private final Context context;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<String[]> waiting = new ArrayList<>();
    private TextToSpeech tts;
    private volatile boolean ready = false;

    public TtsBridge(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
        // Ask for Google's engine; Android falls back to the default engine if it is missing.
        tts = new TextToSpeech(this.context, status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { callJs("TTS_onDone", id); }
                    @Override @SuppressWarnings("deprecation") public void onError(String id) { callJs("TTS_onError", id); }
                    @Override public void onError(String id, int code) { callJs("TTS_onError", id); }
                    @Override public void onStop(String id, boolean interrupted) { }
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

    private boolean speakNow(String id, String text, String lang, float rate) {
        if (!setLanguage(lang)) {
            callJs("TTS_onError", id);
            return true;
        }
        tts.setSpeechRate(rate > 0 ? rate : 1.0f);
        Bundle params = new Bundle();
        int result = tts.speak(text, TextToSpeech.QUEUE_ADD, params, id);
        if (result != TextToSpeech.SUCCESS) {
            callJs("TTS_onError", id);
        }
        return true;
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
