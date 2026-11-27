package com.keyarcade.app1100;

import android.content.pm.ActivityInfo;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public class KeyArcadeNativeBridge {
        @JavascriptInterface
        public void setOrientation(String mode) {
            runOnUiThread(() -> {
                if ("landscape".equals(mode)) {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                } else if ("portrait".equals(mode)) {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                } else {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                }
            });
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                webView.addJavascriptInterface(new KeyArcadeNativeBridge(), "KeyArcadeNative");
            }
        }
    }
}
