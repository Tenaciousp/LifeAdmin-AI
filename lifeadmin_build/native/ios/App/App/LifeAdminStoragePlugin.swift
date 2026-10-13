import Foundation
import Capacitor
import SQLite3

@objc(LifeAdminStoragePlugin)
public class LifeAdminStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LifeAdminStoragePlugin"
    public let jsName = "LifeAdminStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise)
    ]
    private let lock = NSLock()
    private enum StorageError: Error { case database, conflict, input }
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    private func execute(_ db: OpaquePointer, _ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw StorageError.database }
    }
    private func open() throws -> OpaquePointer {
        let manager = FileManager.default
        let directory = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("LifeAdmin", isDirectory: true)
        try manager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        var db: OpaquePointer?
        guard sqlite3_open_v2(directory.appendingPathComponent("records-v1.sqlite").path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK, let database = db else {
            if let db { sqlite3_close(db) }
            throw StorageError.database
        }
        do {
            sqlite3_busy_timeout(database, 5000)
            try execute(database, "PRAGMA journal_mode=DELETE")
            try execute(database, "PRAGMA synchronous=FULL")
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, "PRAGMA user_version", -1, &statement, nil) == SQLITE_OK else { throw StorageError.database }
            let step = sqlite3_step(statement)
            let version = sqlite3_column_int(statement, 0)
            sqlite3_finalize(statement)
            guard step == SQLITE_ROW, version == 0 || version == 1 else { throw StorageError.database }
            try execute(database, "CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL, data TEXT NOT NULL)")
            if version == 0 { try execute(database, "PRAGMA user_version=1") }
            return database
        } catch { sqlite3_close(database); throw error }
    }
    private func load(_ db: OpaquePointer) throws -> (String, String?) {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT revision, data FROM snapshot WHERE id=1", -1, &statement, nil) == SQLITE_OK else { throw StorageError.database }
        defer { sqlite3_finalize(statement) }
        let result = sqlite3_step(statement)
        if result == SQLITE_DONE { return ("empty", nil) }
        guard result == SQLITE_ROW, let revision = sqlite3_column_text(statement, 0), let data = sqlite3_column_text(statement, 1) else { throw StorageError.database }
        return (String(cString: revision), String(cString: data))
    }
    @objc func read(_ call: CAPPluginCall) {
        lock.lock(); defer { lock.unlock() }
        do {
            let db = try open(); defer { sqlite3_close(db) }
            let (revision, data) = try load(db)
            call.resolve(["revision": revision, "snapshot": data.map { $0 as Any } ?? NSNull()])
        } catch { call.reject("Device records could not be opened.", "storage_read") }
    }
    @objc func write(_ call: CAPPluginCall) {
        lock.lock(); defer { lock.unlock() }
        guard let snapshot = call.getString("snapshot"), let expected = call.getString("expectedRevision"),
              expected.count <= 100, let bytes = snapshot.data(using: .utf8), bytes.count <= 5 * 1024 * 1024,
              let object = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any],
              object["format"] as? String == "lifeadmin-backup", object["version"] as? Int == 1,
              let tasks = object["tasks"] as? [Any], let plans = object["plans"] as? [Any],
              tasks.count <= 10000, plans.count <= 10000 else {
            call.reject("Invalid or unsupported device snapshot.", "storage_input"); return
        }
        do {
            let db = try open(); defer { sqlite3_close(db) }
            try execute(db, "BEGIN IMMEDIATE")
            do {
                let (current, _) = try load(db)
                guard current == expected else { throw StorageError.conflict }
                let revision = UUID().uuidString
                var statement: OpaquePointer?
                guard sqlite3_prepare_v2(db, "INSERT OR REPLACE INTO snapshot (id, revision, data) VALUES (1, ?, ?)", -1, &statement, nil) == SQLITE_OK else { throw StorageError.database }
                let first = sqlite3_bind_text(statement, 1, revision, -1, transient)
                let second = sqlite3_bind_text(statement, 2, snapshot, -1, transient)
                let result = first == SQLITE_OK && second == SQLITE_OK ? sqlite3_step(statement) : SQLITE_ERROR
                sqlite3_finalize(statement)
                guard result == SQLITE_DONE else { throw StorageError.database }
                try execute(db, "COMMIT")
                call.resolve(["revision": revision])
            } catch { try? execute(db, "ROLLBACK"); throw error }
        } catch StorageError.conflict { call.reject("Device records changed. Retry the save.", "conflict") }
        catch { call.reject("The save failed. Existing records were preserved.", "storage_write") }
    }
}
