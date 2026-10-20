import UIKit
import WebKit
import Capacitor

class LifeAdminViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LifeAdminStoragePlugin())
        bridge?.registerPluginInstance(LifeAdminFilesPlugin())
        bridge?.registerPluginInstance(LifeAdminCalendarPlugin())
        guard let webView else { return }
        // CAPBridgeViewController.viewDidLoad starts the first navigation.
        // This hook runs earlier, during loadView. Establish the final root
        // here instead of replacing it while navigation is in progress.
        // Keep scrolling content outside the status bar and home indicator.
        let container = UIView()
        container.backgroundColor = .systemBackground
        view = container
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        let safeArea = container.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: safeArea.topAnchor),
            webView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor)
        ])
    }
}

