# Storybooks (Android)

All 12 illustrated storybooks in English, Arabic and Bangla, in one offline Android app.

- Library with two shelves: *Stories of the Brave* and *Stories from Around the World*
- Books open like real books: drag a page corner, swipe, or use the arrow buttons to turn pages.
  Arabic books turn right-to-left.
- **Read aloud** (▶) reads the page and highlights each paragraph. Arabic phrases inside the
  English and Bangla books are read with an Arabic voice.
  The **auto-turn** button turns the page and keeps reading to the end of the book.
- **Arabic only:** word-meaning pages at the end of each book, plus an **Exercises** button (✎):
  *Choose the meaning*, *Choose the word*, and a *Word list* with tap-to-hear and hide-meanings mode.

## Build and install

1. Open this folder in **Android Studio** (Koala or newer). Let Gradle sync (it downloads the
   Android Gradle Plugin and AndroidX WebKit the first time).
2. Plug in your phone with USB debugging on, and press **Run**.
3. For a file to share: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
   For Google Play, use **Build → Generate Signed App Bundle**.

No Android Studio? Push this folder to a GitHub repository. The included workflow
(`.github/workflows/build-apk.yml`) builds the APK on GitHub's servers; download it from the
run's *Artifacts*.

## Voices (Google Text-to-Speech)

**Phone voice (default):** uses the phone's Google Text-to-Speech engine (Speech Services by
Google). Free and offline. On the phone: *Settings → Accessibility (or System) → Text-to-speech
→ Preferred engine: Google*, then tap the gear and **Install voice data** for **Arabic** and
**Bangla (Bangladesh)**. The app's settings sheet has a button that opens this screen.

**Google Cloud Text-to-Speech API (optional):** more natural voices.
1. In Google Cloud Console, enable *Cloud Text-to-Speech API* and create an API key.
   Restrict the key to that one API.
2. In the app: ⚙ → *Google Cloud Text-to-Speech API* → paste the key.
3. Optionally type voice names (e.g. `ar-XA-Wavenet-B`, `bn-IN-Wavenet-A`, `en-GB-Wavenet-A`).
Each sentence is downloaded once and kept on the phone, so re-reading costs nothing.
If the internet or the key fails, the app falls back to the phone voice.

## Project layout

```
app/src/main/java/com/radon/storybooks/MainActivity.java   WebView host, back button
app/src/main/java/com/radon/storybooks/TtsBridge.java      bridge to Android TextToSpeech
app/src/main/assets/www/                                   the reading app (HTML/CSS/JS, offline)
    index.html, css/app.css, js/app.js, js/tts.js
    js/page-flip.browser.js                                StPageFlip 2.0.7 (MIT licence)
    data/stories.js                                        all 12 books, 3 languages
    fonts/                                                 Amiri, Andika, Marcellus, Hind Siliguri, Tiro Bangla
tools/extract_stories.py                                   rebuilds data/stories.js from the book pages
```

The app name is in `app/src/main/res/values/strings.xml`; the package id is
`com.radon.storybooks` in `app/build.gradle`.

## Adding a new story later

Each book is one entry in `data/stories.js`: shared SVG drawings (`defs`), one picture per page
(`scenes`), and per language a title, the page texts and (for Arabic) the word list.
`tools/extract_stories.py` builds this file from the storybook HTML pages; add the new story
to its `STORIES` list and run it again.
