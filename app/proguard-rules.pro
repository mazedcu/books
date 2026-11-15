# Keep the JavaScript bridge methods called from the WebView
-keepclassmembers class com.radon.storybooks.TtsBridge {
    @android.webkit.JavascriptInterface <methods>;
}
