import UIKit
import WebKit
import Capacitor

class LifeAdminViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(LifeAdminStoragePlugin()); bridge?.registerPluginInstance(LifeAdminFilesPlugin()); bridge?.registerPluginInstance(LifeAdminCalendarPlugin()) }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView else { return }
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

