# Add project specific ProGuard rules here.
-keep class org.rawdatun.campus.** { *; }
-keepclassmembers class * extends android.webkit.WebViewClient { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { *; }
