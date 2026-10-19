import Foundation
import EventKit
import Capacitor

@objc(LifeAdminCalendarPlugin)
public class LifeAdminCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LifeAdminCalendarPlugin"
    public let jsName = "LifeAdminCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "calendars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAll", returnType: CAPPluginReturnPromise)
    ]
    private let store = EKEventStore()
    private let queue = DispatchQueue(label: "uk.co.tenaciouspl.lifeadmin.calendar")
    private let defaults = UserDefaults.standard
    private let registryKey = "LifeAdmin.calendar.entries.v1"
    private let pendingKey = "LifeAdmin.calendar.pending.v1"
    private let ownerKey = "LifeAdmin.calendar.owner.v1"
    private struct Entry { let key: String; let title: String; let date: Date; let day: String; let lead: Int }
    private struct DiaryError: LocalizedError { let message: String; var errorDescription: String? { message } }
    private func permitted() -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) { return status == .fullAccess }
        return status == .authorized
    }
    private func requireAccess() throws {
        guard permitted() else { throw DiaryError(message: "Calendar access is unavailable. Reconnect through Contract diary or review permission in Settings. Bills are unchanged.") }
    }
    private func owner() -> String {
        if let value = defaults.string(forKey: ownerKey) { return value }
        let value = UUID().uuidString
        defaults.set(value, forKey: ownerKey)
        return value
    }
    private func marker(_ key: String) -> String { "LifeAdmin diary entry.\nManaged by " + owner() + "/" + key }
    private func rows(_ key: String) -> [String: [String: String]] {
        defaults.dictionary(forKey: key) as? [String: [String: String]] ?? [:]
    }
    private func formatter() -> DateFormatter {
        let value = DateFormatter()
        value.locale = Locale(identifier: "en_US_POSIX")
        value.calendar = Calendar(identifier: .gregorian)
        value.timeZone = .current
        value.dateFormat = "yyyy-MM-dd"
        value.isLenient = false
        return value
    }
    private func writable(_ id: String) throws -> EKCalendar {
        guard let calendar = store.calendar(withIdentifier: id), calendar.allowsContentModifications else {
            throw DiaryError(message: "The selected calendar is unavailable or read-only. Choose a writable calendar and retry.")
        }
        return calendar
    }
    @objc func calendars(_ call: CAPPluginCall) {
        let finish: () -> Void = { self.queue.async {
            do {
                try self.requireAccess()
                let list = self.store.calendars(for: .event).filter { $0.allowsContentModifications }.map {
                    ["id": $0.calendarIdentifier, "title": $0.title + " · " + $0.source.title]
                }
                call.resolve(["calendars": list])
            } catch { call.reject(error.localizedDescription, "calendar_access") }
        } }
        if permitted() { finish(); return }
        guard call.getBool("requestPermission") == true else { call.reject("Calendar permission is required.", "calendar_access"); return }
        DispatchQueue.main.async {
            let completion: EKEventStoreRequestAccessCompletionHandler = { granted, _ in
                if granted { finish() }
                else { call.reject("Calendar permission was not granted. Saved bills are unchanged.", "calendar_access") }
            }
            if #available(iOS 17.0, *) { self.store.requestFullAccessToEvents(completion: completion) }
            else { self.store.requestAccess(to: .event, completion: completion) }
        }
    }
    private func entries(_ call: CAPPluginCall) throws -> [Entry] {
        guard let values = call.getArray("events", JSObject.self), values.count <= 1000 else { throw DiaryError(message: "Invalid diary entries.") }
        let titles = ["contract_expiry": "Contract expiry", "renewal_date": "Renewal date", "notice_deadline": "Cancellation notice deadline", "follow_up_date": "Follow-up date"]
        let format = formatter()
        var seen = Set<String>()
        return try values.map { value in
            guard let key = value["key"] as? String,
                  key.range(of: "^[A-Za-z0-9_-]{1,100}/(contract_expiry|renewal_date|notice_deadline|follow_up_date)$", options: .regularExpression) != nil,
                  seen.insert(key).inserted,
                  let day = value["date"] as? String, day >= "1900-01-01", day <= "2199-12-31",
                  let date = format.date(from: day), format.string(from: date) == day,
                  let lead = value["leadDays"] as? Int, [0, 7, 14, 30].contains(lead),
                  let kind = key.split(separator: "/").last, let label = titles[String(kind)] else {
                throw DiaryError(message: "Check the diary dates and reminder settings. No calendar changes were committed.")
            }
            return Entry(key: key, title: "LifeAdmin: " + label, date: date, day: day, lead: lead)
        }
    }
    // Event identifiers sometimes change after provider synchronization. Recover
    // only exact installation markers, inside the expected calendar/date window.
    private func find(_ key: String, candidates: [[String: String]]) -> EKEvent? {
        let note = marker(key)
        for row in candidates {
            if let id = row["id"], let event = store.event(withIdentifier: id), event.notes == note { return event }
        }
        let calendarMath = Calendar.current
        let format = formatter()
        for row in candidates {
            guard let calendarId = row["calendar"], let calendar = store.calendar(withIdentifier: calendarId),
                  let day = row["date"], let date = format.date(from: day),
                  let start = calendarMath.date(byAdding: .day, value: -1, to: date),
                  let end = calendarMath.date(byAdding: .day, value: 2, to: date) else { continue }
            let predicate = store.predicateForEvents(withStart: start, end: end, calendars: [calendar])
            if let event = store.events(matching: predicate).first(where: { $0.notes == note }) { return event }
        }
        return nil
    }
    @objc func sync(_ call: CAPPluginCall) { queue.async {
        do {
            try self.requireAccess()
            guard let id = call.getString("calendarId") else { throw DiaryError(message: "Choose a calendar.") }
            let calendar = try self.writable(id)
            let entries = try self.entries(call) // Validate all input before any mutation.
            let old = self.rows(self.registryKey), pending = self.rows(self.pendingKey)
            var journal = old.merging(pending) { _, new in new }
            for entry in entries { journal[entry.key] = ["calendar": id, "date": entry.day, "id": old[entry.key]?["id"] ?? ""] }
            self.defaults.set(journal, forKey: self.pendingKey)
            var next: [String: [String: String]] = [:]
            var changed: [(String, EKEvent, String)] = []
            var skipped = 0
            let math = Calendar.current
            let today = math.startOfDay(for: Date())
            let wanted = Set(entries.map { $0.key })
            for key in Set(old.keys).union(pending.keys).subtracting(wanted) {
                if let event = self.find(key, candidates: [old[key], pending[key]].compactMap { $0 }) { try self.store.remove(event, span: .thisEvent, commit: false) }
            }
            for entry in entries {
                let row = ["calendar": id, "date": entry.day]
                let existing = self.find(entry.key, candidates: [old[entry.key], pending[entry.key], row].compactMap { $0 })
                if existing == nil && entry.date < today { skipped += 1; continue }
                let event = existing ?? EKEvent(eventStore: self.store)
                guard let end = math.date(byAdding: .day, value: 1, to: entry.date),
                      let reminderDay = math.date(byAdding: .day, value: -entry.lead, to: entry.date),
                      let alert = math.date(bySettingHour: 9, minute: 0, second: 0, of: reminderDay) else { throw DiaryError(message: "Diary date could not be scheduled.") }
                let alarms = alert > Date() ? [EKAlarm(absoluteDate: alert)] : []
                let alarmDates = event.alarms?.compactMap { $0.absoluteDate } ?? []
                if existing == nil || event.calendar.calendarIdentifier != id || event.title != entry.title || !event.isAllDay || event.startDate != entry.date || event.endDate != end || alarmDates != alarms.compactMap({ $0.absoluteDate }) {
                    event.calendar = calendar; event.title = entry.title; event.notes = self.marker(entry.key)
                    event.isAllDay = true; event.startDate = entry.date; event.endDate = end; event.timeZone = .current
                    event.alarms = alarms
                    try self.store.save(event, span: .thisEvent, commit: false)
                }
                changed.append((entry.key, event, entry.day))
            }
            try self.store.commit()
            for (key, event, day) in changed { next[key] = ["id": event.eventIdentifier ?? "", "calendar": id, "date": day] }
            self.defaults.set(next, forKey: self.registryKey)
            self.defaults.removeObject(forKey: self.pendingKey)
            call.resolve(["count": next.count, "skippedPast": skipped])
        } catch {
            self.store.reset()
            call.reject("Diary update failed. " + error.localizedDescription + " Saved bills are unchanged; retry after checking calendar access.", "calendar_sync")
        }
    } }
    @objc func removeAll(_ call: CAPPluginCall) { queue.async {
        do {
            try self.requireAccess()
            let old = self.rows(self.registryKey), pending = self.rows(self.pendingKey)
            for key in Set(old.keys).union(pending.keys) {
                if let event = self.find(key, candidates: [old[key], pending[key]].compactMap { $0 }) { try self.store.remove(event, span: .thisEvent, commit: false) }
            }
            try self.store.commit()
            self.defaults.removeObject(forKey: self.registryKey); self.defaults.removeObject(forKey: self.pendingKey)
            call.resolve()
        } catch { self.store.reset(); call.reject("Calendar entry removal failed. " + error.localizedDescription, "calendar_remove") }
    } }
}
