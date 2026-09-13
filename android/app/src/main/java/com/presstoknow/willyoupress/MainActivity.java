package com.presstoknow.willyoupress;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String APP_ORIGIN = "appassets.androidplatform.net";
    private WebView gameView;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enterImmersiveMode();

        gameView = new WebView(this);
        gameView.setBackgroundColor(Color.rgb(15, 5, 36));
        gameView.setWebChromeClient(new WebChromeClient());
        gameView.setWebViewClient(new LocalGameClient());

        WebSettings settings = gameView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);

        setContentView(gameView);
        if (state == null) {
            gameView.loadUrl("https://" + APP_ORIGIN + "/index.html");
        } else {
            gameView.restoreState(state);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        gameView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        if (gameView.canGoBack()) gameView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (gameView != null) {
            gameView.stopLoading();
            gameView.destroy();
        }
        super.onDestroy();
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private final class LocalGameClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) || !APP_ORIGIN.equals(uri.getHost())) {
                return super.shouldInterceptRequest(view, request);
            }

            String assetPath = uri.getPath();
            if (assetPath == null || assetPath.equals("/")) assetPath = "/index.html";
            assetPath = assetPath.substring(1);
            if (assetPath.contains("..")) return notFound();

            try {
                InputStream stream = getAssets().open(assetPath);
                String mime = mimeType(assetPath);
                String encoding = isText(mime) ? "UTF-8" : null;
                Map<String, String> headers = new HashMap<>();
                headers.put("Access-Control-Allow-Origin", "*");
                headers.put("Cache-Control", "no-cache");
                return new WebResourceResponse(mime, encoding, 200, "OK", headers, stream);
            } catch (IOException ignored) {
                return notFound();
            }
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), null);
        }

        private boolean isText(String mime) {
            return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json");
        }

        private String mimeType(String path) {
            String lower = path.toLowerCase(Locale.US);
            if (lower.endsWith(".html")) return "text/html";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".js")) return "application/javascript";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".wasm")) return "application/wasm";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".mp3")) return "audio/mpeg";
            return "application/octet-stream";
        }
    }
}
