import Capacitor

class LifeAdminViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(LifeAdminStoragePlugin()) }
}
