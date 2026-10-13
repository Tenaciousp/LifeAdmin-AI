import Foundation
import UIKit
import UniformTypeIdentifiers
import Capacitor

@objc(LifeAdminFilesPlugin)
public class LifeAdminFilesPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "LifeAdminFilesPlugin"
    public let jsName = "LifeAdminFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "exportBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copyText", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?
    private var temporary: URL?
    private var exporting = false
    private let limit = 5 * 1024 * 1024

    private func finish(_ value: [String: Any]? = nil, error: String? = nil, code: String? = nil) {
        let call = pending
        pending = nil
        if let temporary { try? FileManager.default.removeItem(at: temporary.deletingLastPathComponent()) }
        temporary = nil
        if let error { call?.reject(error, code) }
        else { call?.resolve(value ?? [:]) }
    }
    @objc func exportBackup(_ call: CAPPluginCall) {
        guard let snapshot = call.getString("snapshot"), let bytes = snapshot.data(using: .utf8), bytes.count <= limit else {
            call.reject("Invalid or oversized backup.", "file_input"); return
        }
        DispatchQueue.main.async {
            guard self.pending == nil, let controller = self.bridge?.viewController, controller.presentedViewController == nil else { call.reject("Finish the current file selection.", "file_busy"); return }
            do {
                let folder = FileManager.default.temporaryDirectory.appendingPathComponent("lifeadmin-export-" + UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
                let file = folder.appendingPathComponent("lifeadmin-backup.json")
                self.temporary = file
                try bytes.write(to: file, options: .atomic)
                self.pending = call; self.exporting = true
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                picker.delegate = self
                controller.present(picker, animated: true)
            } catch {
                if let temporary = self.temporary { try? FileManager.default.removeItem(at: temporary.deletingLastPathComponent()) }
                self.temporary = nil
                call.reject("Backup file could not be prepared.", "file_write")
            }
        }
    }
    @objc func copyText(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), text.utf16.count <= 262144 else {
            call.reject("Plan text is too large to copy.", "clipboard_input"); return
        }
        DispatchQueue.main.async {
            UIPasteboard.general.setItems([["public.utf8-plain-text": text]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(300)])
            call.resolve()
        }
    }
    @objc func importBackup(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil, let controller = self.bridge?.viewController, controller.presentedViewController == nil else { call.reject("Finish the current file selection.", "file_busy"); return }
            self.pending = call; self.exporting = false
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: false)
            picker.allowsMultipleSelection = false; picker.delegate = self
            controller.present(picker, animated: true)
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finish(error: "Backup selection cancelled.", code: "cancelled")
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if exporting { finish(); return }
        guard let file = urls.first else { finish(error: "No backup selected.", code: "cancelled"); return }
        let access = file.startAccessingSecurityScopedResource()
        defer { if access { file.stopAccessingSecurityScopedResource() } }
        do {
            let handle = try FileHandle(forReadingFrom: file)
            defer { try? handle.close() }
            var bytes = Data()
            while true {
                let chunk = try handle.read(upToCount: min(8192, limit + 1 - bytes.count)) ?? Data()
                if chunk.isEmpty { break }
                bytes.append(chunk)
                guard bytes.count <= limit else { finish(error: "Backup exceeds 5 MB.", code: "file_read"); return }
            }
            guard let text = String(data: bytes, encoding: .utf8) else {
                finish(error: "Backup must be a UTF-8 JSON file no larger than 5 MB.", code: "file_read"); return
            }
            controller.dismiss(animated: true) { self.finish(["snapshot": text]) }
        } catch { finish(error: "Backup file could not be opened.", code: "file_read") }
    }
}
