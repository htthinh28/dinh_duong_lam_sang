package com.phuongchau.dinhduong

import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineBanner: TextView
    private lateinit var retryButton: Button
    private lateinit var refreshButton: Button
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback ?: return@registerForActivityResult
        val data = result.data
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
        callback.onReceiveValue(uris)
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        offlineBanner = findViewById(R.id.offlineBanner)
        retryButton = findViewById(R.id.retryButton)
        refreshButton = findViewById(R.id.refreshButton)

        retryButton.setOnClickListener { loadApp(forceReload = true) }
        refreshButton.setOnClickListener { performManualRefresh() }

        setupWebView()
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
            hideOfflineUI()
        } else {
            loadApp()
        }
        setupBackPressed()
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme.orEmpty().lowercase()
                if (scheme == "http" || scheme == "https") return false
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showOfflineUI()
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                return runCatching {
                    filePickerLauncher.launch(intent)
                    true
                }.getOrElse {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
    }

    /** Làm mới WebView khi người dùng bấm nút (thay cho kéo-xuống-refresh). */
    private fun performManualRefresh() {
        if (isNetworkAvailable()) {
            hideOfflineUI()
            progressBar.visibility = View.VISIBLE
            webView.reload()
        } else {
            showOfflineUI()
        }
    }

    private fun loadApp(forceReload: Boolean = false) {
        if (isNetworkAvailable()) {
            hideOfflineUI()
            progressBar.visibility = View.VISIBLE
            if (forceReload) {
                webView.loadUrl(BuildConfig.WEB_APP_URL)
            } else if (webView.url.isNullOrBlank()) {
                webView.loadUrl(BuildConfig.WEB_APP_URL)
            } else {
                webView.reload()
            }
        } else {
            showOfflineUI()
        }
    }

    private fun setupBackPressed() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return false
            val capabilities = cm.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }
    }

    private fun showOfflineUI() {
        offlineBanner.visibility = View.VISIBLE
        retryButton.visibility = View.VISIBLE
    }

    private fun hideOfflineUI() {
        offlineBanner.visibility = View.GONE
        retryButton.visibility = View.GONE
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.apply {
            stopLoading()
            destroy()
        }
        super.onDestroy()
    }
}
