package org.rawdatun.campus;

import android.Manifest;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static final String HOME_URL = "https://campus.rawdatun.org";
    private static final int PERMISSION_REQUEST_CODE = 101;

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefreshLayout;
    private FrameLayout errorLayout;
    private TextView errorMessage;
    private ImageButton btnBack, btnForward, btnRefresh, btnHome;

    // For file upload
    private ValueCallback<Uri[]> filePathCallback;
    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    results = new Uri[]{result.getData().getData()};
                }
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                }
            });

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Toast.makeText(context, "✓ Download complete!", Toast.LENGTH_SHORT).show();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Bind views
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        errorLayout = findViewById(R.id.errorLayout);
        errorMessage = findViewById(R.id.errorMessage);
        btnBack = findViewById(R.id.btnBack);
        btnForward = findViewById(R.id.btnForward);
        btnRefresh = findViewById(R.id.btnRefresh);
        btnHome = findViewById(R.id.btnHome);

        setupWebView();
        setupNavigationBar();
        setupSwipeRefresh();
        setupDownloadListener();

        // Register download complete receiver
        registerReceiver(downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));

        // Load the site
        loadUrl(HOME_URL);
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Enable cookies
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
                errorLayout.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                updateNavButtons();
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                    swipeRefreshLayout.setRefreshing(false);
                    showError();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Open external links in browser
                if (!url.contains("rawdatun.org")) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                fileChooserLauncher.launch(intent);
                return true;
            }
        });
    }

    private void setupNavigationBar() {
        btnBack.setOnClickListener(v -> {
            if (webView.canGoBack()) webView.goBack();
        });

        btnForward.setOnClickListener(v -> {
            if (webView.canGoForward()) webView.goForward();
        });

        btnRefresh.setOnClickListener(v -> {
            if (!isNetworkAvailable()) {
                showError();
                return;
            }
            webView.reload();
        });

        btnHome.setOnClickListener(v -> loadUrl(HOME_URL));
    }

    private void setupSwipeRefresh() {
        swipeRefreshLayout.setColorSchemeResources(
                R.color.primary, R.color.accent);
        swipeRefreshLayout.setOnRefreshListener(() -> {
            if (!isNetworkAvailable()) {
                swipeRefreshLayout.setRefreshing(false);
                showError();
                return;
            }
            webView.reload();
        });
    }

    private void setupDownloadListener() {
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            // Check permission
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
                    ContextCompat.checkSelfPermission(this,
                            Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                        PERMISSION_REQUEST_CODE);
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimetype);
            String cookies = CookieManager.getInstance().getCookie(url);
            request.addRequestHeader("cookie", cookies);
            request.addRequestHeader("User-Agent", userAgent);
            request.setDescription("Downloading file...");
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
            request.setTitle(fileName);
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
                Toast.makeText(this, "Downloading " + fileName, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void loadUrl(String url) {
        if (!isNetworkAvailable()) {
            showError();
            return;
        }
        errorLayout.setVisibility(View.GONE);
        webView.loadUrl(url);
    }

    private void showError() {
        errorLayout.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);

        View retryBtn = findViewById(R.id.btnRetry);
        retryBtn.setOnClickListener(v -> {
            if (isNetworkAvailable()) {
                webView.setVisibility(View.VISIBLE);
                errorLayout.setVisibility(View.GONE);
                webView.reload();
            } else {
                Toast.makeText(this, "Still no internet connection", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager)
                getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    private void updateNavButtons() {
        btnBack.setAlpha(webView.canGoBack() ? 1f : 0.4f);
        btnForward.setAlpha(webView.canGoForward() ? 1f : 0.4f);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(downloadReceiver);
        webView.destroy();
    }
}
