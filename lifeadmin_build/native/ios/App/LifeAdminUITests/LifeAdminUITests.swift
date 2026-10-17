import XCTest

final class LifeAdminUITests: XCTestCase {
    private let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
        let screen = XCTAttachment(screenshot: app.screenshot())
        screen.name = "Final customer screen"
        screen.lifetime = .keepAlways
        add(screen)
        if let run = testRun, run.hasSucceeded == false {
            let description = app.debugDescription
            print(description)
            let tree = XCTAttachment(string: description)
            tree.name = "Accessibility tree on failure"
            tree.lifetime = .keepAlways
            add(tree)
        }
        app.terminate()
    }

    private func reveal(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        for _ in 0..<14 {
            if element.exists && element.isHittable { return }
            app.swipeUp()
        }
        print(app.debugDescription)
        XCTFail("Control is not reachable: \(element)", file: file, line: line)
    }

    private func enterText(_ value: String, into field: XCUIElement) {
        // Separate keyboard events let the controlled web field settle between keys.
        for character in value { field.typeText(String(character)) }
        let complete = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", value), object: field)
        XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 10), .completed)
    }

    private func confirm(timeout: TimeInterval = 5) {
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: timeout))
        let accept = alert.buttons.matching(NSPredicate(format: "label ==[c] %@", "OK")).firstMatch
        XCTAssertTrue(accept.waitForExistence(timeout: timeout))
        accept.tap()
    }

    private func dismissKeyboardTutorial() {
        // Fresh simulators display Apple's slide-to-type introduction above
        // the keyboard. Only dismiss this identified system tutorial.
        let tutorial = app.otherElements["UIContinuousPathIntroductionView"]
        if tutorial.waitForExistence(timeout: 3) {
            let proceed = tutorial.buttons["Continue"]
            XCTAssertTrue(proceed.isHittable)
            proceed.tap()
            let gone = XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "exists == false"), object: tutorial)
            XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 5), .completed)
        }
    }

    private func closeKeyboard() {
        dismissKeyboardTutorial()
        let hide = app.keyboards.buttons["Hide keyboard"]
        if hide.exists {
            XCTAssertTrue(hide.isHittable)
            hide.tap()
        } else {
            let done = app.toolbars.buttons["Done"]
            XCTAssertTrue(done.waitForExistence(timeout: 5))
            XCTAssertTrue(done.isHittable)
            done.tap()
        }
        let closed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for: [closed], timeout: 5), .completed)
    }

    private func pickerControl(
        _ label: String, type: XCUIElement.ElementType = .button
    ) -> XCUIElement {
        // A labelled wrapper may appear before the actionable remote button.
        let control = app.descendants(matching: type).matching(
            NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(control.waitForExistence(timeout: 45))
        XCTAssertTrue(control.frame.intersects(app.frame))
        if type == .button {
            let ready = XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "hittable == true"), object: control)
            XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed)
        }
        return control
    }

    private func cancelFilePicker(exporting: Bool = false) {
        if exporting {
            _ = pickerControl("Save")
            if app.buttons["Cancel"].exists {
                // The iPad export picker exposes Cancel in its sidebar.
                pickerControl("Cancel").tap()
            } else {
                // The iPhone sheet has no Cancel button and supports dismissal.
                let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1))
                let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
                start.press(forDuration: 0.1, thenDragTo: end)
            }
        } else {
            pickerControl("Cancel").tap()
        }
        XCTAssertTrue(app.staticTexts[
            "Backup action cancelled. Existing records are unchanged."
        ].waitForExistence(timeout: 30))
    }

    private func addSubscription(named name: String) {
        let search = app.textFields.firstMatch
        search.tap()
        dismissKeyboardTutorial()
        enterText("Cancel Netflix", into: search)
        XCTAssertEqual(search.value as? String, "Cancel Netflix")
        closeKeyboard()
        app.buttons["Search"].tap()
        XCTAssertTrue(app.buttons["Use suggestion"].waitForExistence(timeout: 5))
        app.buttons["Use suggestion"].tap()

        let billName = app.textFields.matching(NSPredicate(format:
            "label == %@ OR placeholderValue == %@", "Bill name", "Optional name")).firstMatch
        reveal(billName)
        billName.tap()
        dismissKeyboardTutorial()
        enterText(name, into: billName)
        XCTAssertEqual(billName.value as? String, name)
        closeKeyboard()
        let reference = app.textFields["Account or customer reference"]
        reveal(reference)
        reference.tap()
        enterText("REF-7319", into: reference)
        closeKeyboard()
        let notes = app.textViews["Additional notes"]
        reveal(notes)
        notes.tap()
        enterText("Note7319", into: notes)
        closeKeyboard()
        let save = app.buttons["Save bill"]
        reveal(save)
        save.tap()
        XCTAssertTrue(app.staticTexts["Bill saved on this device."].waitForExistence(timeout: 10))
    }

    private func selectExportedBackup(named prefix: String = "lifeadmin-backup") {
        let backups = app.buttons["Manage backups"]
        reveal(backups)
        backups.tap()
        let restore = app.buttons["Restore backup"]
        reveal(restore)
        restore.tap()
        let document = app.cells.matching(
            NSPredicate(format: "label BEGINSWITH[c] %@", prefix)).firstMatch
        // Export saves to the local location, which need not appear in Recents.
        // iPad already displays Browse as a sidebar; iPhone uses a Browse tab.
        if !app.cells["DOC.sidebar.item.On My iPad"].waitForExistence(timeout: 3) {
            pickerControl("Browse").tap()
        }
        if !document.waitForExistence(timeout: 5) {
            let local = app.descendants(matching: .any).matching(
                NSPredicate(format: "label IN %@", ["On My iPhone", "On My iPad"])).firstMatch
            XCTAssertTrue(local.waitForExistence(timeout: 45))
            XCTAssertTrue(local.frame.intersects(app.frame))
            local.coordinate(
                withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        guard document.waitForExistence(timeout: 45) else {
            print("Restore document controls:\n" + app.debugDescription)
            XCTFail("Exported LifeAdmin document was not available for restore")
            return
        }
        XCTAssertTrue(document.frame.intersects(app.frame))
        // In icon mode the cell centre falls in the filename area. Target the
        // document image observed inside this cell, above the filename.
        let icon = document.images.firstMatch
        XCTAssertTrue(icon.waitForExistence(timeout: 10))
        XCTAssertTrue(icon.frame.intersects(app.frame))
        XCTAssertGreaterThan(icon.frame.width, 0)
        XCTAssertGreaterThan(icon.frame.height, 0)
        icon.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func testNativeBackupRoundTripAndCancellationPreserveRecords() throws {
        // Cold simulator startup may wait on OS navigation services before
        // loading the bundled page. Keep later process-restart checks at 20s.
        let initialLaunchStarted = Date()
        app.launch()
        let initialUIReady = app.buttons["Search"].waitForExistence(timeout: 60)
        print("Initial customer UI ready: \(initialUIReady); elapsed: \(Date().timeIntervalSince(initialLaunchStarted))s")
        XCTAssertTrue(initialUIReady, "Initial customer UI did not load within 60 seconds")
        addSubscription(named: "CI sample subscription")

        let create = app.buttons["Create plan"]
        reveal(create)
        create.tap()
        confirm()
        XCTAssertTrue(app.staticTexts["Plan saved on this device."].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Open plan"].exists)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let open = app.buttons["Open plan"]
        reveal(open)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)

        // Exercise native file-picker cancellation with acknowledged records.
        // No document is selected and no cloud account is needed.
        let backups = app.buttons["Manage backups"]
        reveal(backups)
        backups.tap()
        let restore = app.buttons["Restore backup"]
        reveal(restore)
        restore.tap()
        cancelFilePicker()
        let export = app.buttons["Export backup"]
        reveal(export)
        export.tap()
        confirm()
        cancelFilePicker(exporting: true)

        // Cancellation must preserve both records through a process restart.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))

        // Save a real JSON document through Apple's picker before deletion.
        reveal(backups)
        backups.tap()
        reveal(export)
        export.tap()
        confirm()
        pickerControl("Save").tap()
        XCTAssertTrue(app.staticTexts[
            "Backup export completed. Check the chosen file before relying on this copy."
        ].waitForExistence(timeout: 15))

        // Restart at the top, then delete the bill and its associated plan.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let delete = app.buttons["Delete bill"]
        reveal(delete)
        delete.tap()
        confirm()
        XCTAssertTrue(app.staticTexts["Bill and associated plans deleted."].waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let empty = app.otherElements["Your bills (0)"]
        reveal(empty)
        XCTAssertTrue(app.otherElements["Saved plans (0)"].exists)
        XCTAssertFalse(app.buttons["Open plan"].exists)

        // Restore the exported document through the system picker.
        selectExportedBackup()
        confirm(timeout: 30)
        XCTAssertTrue(app.staticTexts["Backup restored on this device."].waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))

        // Records created after export must survive a declined replacement.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        addSubscription(named: "After backup")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        selectExportedBackup()
        let replacement = app.alerts.firstMatch
        XCTAssertTrue(replacement.waitForExistence(timeout: 30))
        let decline = replacement.buttons.matching(
            NSPredicate(format: "label ==[c] %@", "Cancel")).firstMatch
        XCTAssertTrue(decline.waitForExistence(timeout: 5))
        decline.tap()
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "enabled == true"),
            object: app.buttons["Restore backup"])
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 10), .completed)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.otherElements["Your bills (2)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertTrue(app.staticTexts["After backup"].exists)

        // Accepting the same backup must replace the later record.
        selectExportedBackup()
        confirm(timeout: 30)
        XCTAssertTrue(app.staticTexts["Backup restored on this device."].waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertFalse(app.staticTexts["After backup"].exists)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
    }

    func testNativeBackupRejectsInvalidFiles() throws {
        // The host creates these synthetic files beside the real export only
        // after the round-trip test and its complete-record check pass.
        // Native file selection validates before offering record replacement.
        // Invalid files must show an error without a destructive confirmation.
        let cases: [(String, String)] = [
            ("ci-malformed.json", "Backup is not valid JSON."),
            ("ci-future.json", "Unsupported LifeAdmin backup."),
            ("ci-invalid-plan.json", "Invalid saved plan missing details."),
            ("ci-oversized.json", "Backup exceeds 5 MB.")
        ]
        for (filename, message) in cases {
            app.terminate()
            app.launch()
            XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
            selectExportedBackup(named: filename)
            XCTAssertTrue(app.staticTexts[message].waitForExistence(timeout: 30), filename)
            XCTAssertFalse(app.alerts.firstMatch.exists, filename)
            app.terminate()
            app.launch()
            XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
            let open = app.buttons["Open plan"]
            reveal(open)
            XCTAssertTrue(app.otherElements["Your bills (1)"].exists, filename)
            XCTAssertTrue(app.otherElements["Saved plans (1)"].exists, filename)
            XCTAssertTrue(app.staticTexts["CI sample subscription"].exists, filename)
        }
    }

    func testInterruptedBackupPickersPreserveRecords() throws {
        // Run after the round-trip test has created acknowledged synthetic data.
        for exporting in [false, true] {
            app.launch()
            XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
            let backups = app.buttons["Manage backups"]
            reveal(backups)
            backups.tap()
            let action = app.buttons[exporting ? "Export backup" : "Restore backup"]
            reveal(action)
            action.tap()
            if exporting { confirm() }
            _ = pickerControl(exporting ? "Save" : "Cancel")
            // Simulate process termination while the native picker is open.
            app.terminate()
            app.launch()
            XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
            let open = app.buttons["Open plan"]
            reveal(open)
            XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
            XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
            XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
            open.tap()
            XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
            app.terminate()
        }

        // A fresh request must work after termination clears the pending picker.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let backups = app.buttons["Manage backups"]
        reveal(backups)
        backups.tap()
        let restore = app.buttons["Restore backup"]
        reveal(restore)
        restore.tap()
        cancelFilePicker()
    }

    func testRejectedNativeWritePreservesRecords() throws {
        // The host installs a test-only SQLite trigger while the app is stopped.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let markDone = app.buttons["Mark done"]
        reveal(markDone)
        markDone.tap()
        XCTAssertTrue(app.staticTexts[
            "The save failed. Existing records were preserved."
        ].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["Bill status saved."].exists)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(markDone)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertFalse(app.buttons["Reopen"].exists)
        let open = app.buttons["Open plan"]
        reveal(open)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
    }

    func testNativeWriteRecoversAfterRejection() throws {
        // The host removed the injected failure before starting this test.
        try verifyNativeSavesAndOriginalPlan()
    }

    func testInterruptedSnapshotRecoveryPreservesRecords() throws {
        // Host writer was SIGKILLed with a hot rollback journal. The app must
        // recover the original snapshot before saving new acknowledged changes.
        try verifyNativeSavesAndOriginalPlan()
    }

    private func verifyNativeSavesAndOriginalPlan() throws {
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let markDone = app.buttons["Mark done"]
        reveal(markDone)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        XCTAssertFalse(app.buttons["Reopen"].exists)
        markDone.tap()
        XCTAssertTrue(app.staticTexts["Bill status saved."].waitForExistence(timeout: 20))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let reopen = app.buttons["Reopen"]
        reveal(reopen)
        reopen.tap()
        XCTAssertTrue(app.staticTexts["Bill status saved."].waitForExistence(timeout: 20))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(markDone)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        let open = app.buttons["Open plan"]
        reveal(open)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
    }

    func testUnsupportedNativeStorageVersionBlocksWorkspace() throws {
        // The host sets user_version=2 on the populated disposable database.
        app.launch()
        XCTAssertTrue(app.staticTexts["Device records could not be opened."].waitForExistence(timeout: 20))
        let retry = app.buttons["Retry storage"]
        XCTAssertTrue(retry.exists)
        XCTAssertFalse(app.buttons["Search"].exists)
        XCTAssertFalse(app.buttons["Save bill"].exists)
        XCTAssertFalse(app.buttons["Manage backups"].exists)
        XCTAssertFalse(app.otherElements["Your bills (0)"].exists)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["Device records could not be opened."].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["Retry storage"].exists)
        XCTAssertFalse(app.buttons["Search"].exists)
    }

    func testNativeStorageVersionRecoveryPreservesRecords() throws {
        // The host restores the supported version without touching record data.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["Retry storage"].exists)
        let open = app.buttons["Open plan"]
        reveal(open)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
    }

    func testRotationPreservesSavedRecordsAndPlan() throws {
        defer { XCUIDevice.shared.orientation = .portrait }
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let open = app.buttons["Open plan"]
        reveal(open)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))

        XCUIDevice.shared.orientation = .landscapeLeft
        let landscape = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in self.app.frame.width > self.app.frame.height },
            object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 10), .completed)
        let webLayout = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                let frame = self.app.webViews.firstMatch.frame
                return frame.width > frame.height
            }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [webLayout], timeout: 10), .completed)
        let nextSteps = app.staticTexts["Next Steps"]
        reveal(nextSteps)
        XCTAssertTrue(app.buttons["Copy plan"].exists)
        // App-region capture used a portrait crop after rotation in CI #364.
        // Capture the full display and reject a non-landscape image.
        let fullScreen = XCUIScreen.main.screenshot()
        print("Landscape geometry: app=\(app.frame), web=\(app.webViews.firstMatch.frame), image=\(fullScreen.image.size)")
        XCTAssertGreaterThan(fullScreen.image.size.width, fullScreen.image.size.height)
        let landscapeScreen = XCTAttachment(screenshot: fullScreen)
        landscapeScreen.name = "Saved plan in landscape"
        landscapeScreen.lifetime = .keepAlways
        add(landscapeScreen)

        XCUIDevice.shared.orientation = .portrait
        let portrait = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in self.app.frame.height > self.app.frame.width },
            object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [portrait], timeout: 10), .completed)
        XCTAssertTrue(app.buttons["Copy plan"].exists)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
    }

    func testNativePlanClipboardPastePreservesRecords() throws {
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let open = app.buttons["Open plan"]
        reveal(open)
        open.tap()
        let copy = app.buttons["Copy plan"]
        reveal(copy)
        copy.tap()
        XCTAssertTrue(app.staticTexts[
            "Plan copied. Review before sharing."
        ].waitForExistence(timeout: 10))

        // A fresh process provides an empty, unsaved field. Use the customer's
        // Paste action rather than reading the clipboard from the test runner.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let field = app.textFields["Bill or provider"]
        XCTAssertTrue(field.exists)
        field.tap()
        field.press(forDuration: 1)
        let menuPaste = app.menuItems["Paste"]
        let paste = menuPaste.waitForExistence(timeout: 3) ? menuPaste : app.buttons["Paste"]
        XCTAssertTrue(paste.waitForExistence(timeout: 10))
        paste.tap()
        let pasted = XCTNSPredicateExpectation(
            predicate: NSPredicate(
                format: "value CONTAINS %@ AND value CONTAINS %@ AND value CONTAINS %@ AND value CONTAINS %@",
                "# CI sample subscription", "REF-7319",
                "Nothing is sent automatically.", "## next steps"),
            object: field)
        XCTAssertEqual(XCTWaiter.wait(for: [pasted], timeout: 10), .completed)

        // Do not submit the pasted text or save a new bill.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        XCTAssertTrue(app.staticTexts["CI sample subscription"].exists)
        open.tap()
        XCTAssertTrue(app.buttons["Copy plan"].waitForExistence(timeout: 5))
    }

    func testMessageEditingCancelSaveAndRestart() throws {
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let open = app.buttons["Open plan"]
        reveal(open)
        open.tap()
        let edit = app.buttons["Edit message"]
        reveal(edit)
        edit.tap()
        let subject = app.textFields["Message subject"]
        let body = app.textViews["Message body"]
        reveal(subject)
        let originalSubject = try XCTUnwrap(subject.value as? String)
        let originalBody = try XCTUnwrap(body.value as? String)
        XCTAssertFalse(originalSubject.isEmpty)
        XCTAssertFalse(originalBody.isEmpty)
        XCTAssertFalse(app.buttons["Copy message"].isEnabled)
        subject.tap()
        subject.typeText(" CI cancelled")
        closeKeyboard()
        let cancel = app.buttons["Cancel message edit"]
        reveal(cancel)
        cancel.tap()
        reveal(edit)
        edit.tap()
        XCTAssertEqual(subject.value as? String, originalSubject)
        XCTAssertEqual(body.value as? String, originalBody)
        reveal(subject)
        subject.tap()
        subject.typeText(" CI reviewed 7319")
        closeKeyboard()
        reveal(body)
        body.tap()
        body.typeText(" CI reviewed body 7319")
        closeKeyboard()
        let savedSubject = try XCTUnwrap(subject.value as? String)
        let savedBody = try XCTUnwrap(body.value as? String)
        XCTAssertTrue(savedSubject.contains("CI reviewed 7319"))
        XCTAssertTrue(savedBody.contains("CI reviewed body 7319"))
        let save = app.buttons["Save message"]
        reveal(save)
        save.tap()
        XCTAssertTrue(app.staticTexts["Message saved on this device. Nothing was sent."].waitForExistence(timeout: 20))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        open.tap()
        reveal(edit)
        edit.tap()
        XCTAssertEqual(subject.value as? String, savedSubject)
        XCTAssertEqual(body.value as? String, savedBody)
        reveal(cancel)
        cancel.tap()

        // Restore the earlier synthetic backup, then compare all original
        // fields on the host. Unit tests separately check edit isolation.
        selectExportedBackup()
        confirm(timeout: 30)
        XCTAssertTrue(app.staticTexts["Backup restored on this device."].waitForExistence(timeout: 20))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        open.tap()
        reveal(edit)
        edit.tap()
        XCTAssertEqual(subject.value as? String, originalSubject)
        XCTAssertEqual(body.value as? String, originalBody)
        reveal(cancel)
        cancel.tap()
    }

    func testManualAiPromptReviewAndCopyPreserveRecords() throws {
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let open = app.buttons["Open plan"]
        reveal(open)
        open.tap()
        let prepare = app.buttons["Prepare AI prompt"]
        reveal(prepare)
        prepare.tap()
        let prompt = app.textViews["AI prompt"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 10))
        reveal(prompt)
        XCTAssertTrue((prompt.value as? String ?? "").contains("REF-7319"))
        prompt.tap()
        prompt.typeText(" CI reviewed prompt 7319")
        closeKeyboard()
        let reviewed = try XCTUnwrap(prompt.value as? String)
        XCTAssertTrue(reviewed.contains("CI reviewed prompt 7319"))
        let copy = app.buttons["Copy AI prompt"]
        reveal(copy)
        for name in ["Open ChatGPT", "Open Gemini", "Open Copilot", "Open Claude", "Open Perplexity"] {
            XCTAssertTrue(app.links[name].exists)
        }
        copy.tap()
        XCTAssertTrue(app.staticTexts[
            "AI prompt copied. Paste into your chosen service after reviewing the details."
        ].waitForExistence(timeout: 10))
        XCTAssertEqual(app.state, .runningForeground)

        // Paste into an unsaved local note, never into an external service.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let note = app.textViews["Additional notes"]
        reveal(note)
        note.tap()
        note.press(forDuration: 1)
        let menuPaste = app.menuItems["Paste"]
        let paste = menuPaste.waitForExistence(timeout: 3) ? menuPaste : app.buttons["Paste"]
        XCTAssertTrue(paste.waitForExistence(timeout: 10))
        paste.tap()
        let pasted = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", reviewed), object: note)
        XCTAssertEqual(XCTWaiter.wait(for: [pasted], timeout: 10), .completed)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        reveal(open)
        XCTAssertTrue(app.otherElements["Your bills (1)"].exists)
        XCTAssertTrue(app.otherElements["Saved plans (1)"].exists)
        open.tap()
        reveal(prepare)
        XCTAssertFalse(app.textViews["AI prompt"].exists)
    }

    @MainActor
    func testAppleAccessibilityAuditOnBillsAndPlan() throws {
        guard #available(iOS 17.0, *) else {
            XCTFail("Apple accessibility auditing requires an iOS 17+ test runtime.")
            return
        }
        // This audit now owns the cold simulator launch.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 60))
        var findings: [[String: String]] = []
        func recordFindings(_ stage: String) {
            let data = (try? JSONSerialization.data(withJSONObject: findings, options: [.prettyPrinted, .sortedKeys])) ?? Data()
            let report = String(data: data, encoding: .utf8) ?? "Audit report encoding failed"
            print("Apple accessibility findings: " + report)
            let attachment = XCTAttachment(string: report)
            attachment.name = "Apple accessibility findings: " + stage
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        func audit(_ stage: String) throws {
            print("Apple accessibility audit: " + stage)
            let web = app.webViews.firstMatch.frame
            print("Portrait safe-area geometry: app=\(app.frame), web=\(web)")
            XCTAssertGreaterThan(web.minY, app.frame.minY,
                                 "Scrolling web content must stay below the status bar")
            XCTAssertLessThanOrEqual(web.maxY, app.frame.maxY,
                                     "Web content must remain inside the app window")
            try app.performAccessibilityAudit { issue in
                let element = issue.element
                findings.append([
                    "stage": stage,
                    "audit_type": String(describing: issue.auditType),
                    "summary": issue.compactDescription,
                    "details": issue.detailedDescription,
                    "element_type": element.map { String(describing: $0.elementType) } ?? "Unavailable",
                    "element_label": element?.label ?? "Unavailable",
                    "element_frame": element.map { String(describing: $0.frame) } ?? "Unavailable"
                ])
                if let data = try? JSONSerialization.data(withJSONObject: findings.last ?? [:], options: [.sortedKeys]),
                   let report = String(data: data, encoding: .utf8) {
                    print("Apple accessibility finding: " + report)
                }
                // Collect every issue and view before failing the aggregate.
                // No finding is accepted or excluded from the final assertion.
                return true
            }
            recordFindings(stage)
            let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            screen.name = "Accessibility audit: " + stage
            screen.lifetime = .keepAlways
            add(screen)
        }
        try audit("initial bill-entry screen")

        let open = app.buttons["Open plan"]
        reveal(open)
        try audit("saved bill and plan controls")
        open.tap()
        let nextSteps = app.staticTexts["Next Steps"]
        reveal(nextSteps)
        try audit("saved-plan content")

        let edit = app.buttons["Edit message"]
        reveal(edit)
        edit.tap()
        let subject = app.textFields["Message subject"]
        reveal(subject)
        try audit("message editor")
        let cancel = app.buttons["Cancel message edit"]
        reveal(cancel)
        cancel.tap()

        let prepare = app.buttons["Prepare AI prompt"]
        reveal(prepare)
        prepare.tap()
        let copyPrompt = app.buttons["Copy AI prompt"]
        reveal(copyPrompt)
        try audit("AI prompt review and copy controls")
        app.buttons["Close AI prompt"].tap()

        // Reveal the entire footer rather than relying on off-screen tree
        // presence. Do not activate email or open external pages during QA.
        let email = app.links["Email Tenaciouspl support"]
        let privacy = app.links["App privacy policy"]
        reveal(privacy)
        for link in [email, privacy] {
            XCTAssertTrue(link.exists)
            XCTAssertTrue(link.isHittable)
            XCTAssertTrue(app.frame.contains(link.frame), "Footer link is partly outside the display")
            print("Footer link geometry: label=\(link.label), frame=\(link.frame)")
        }
        try audit("support and privacy footer")
        XCTAssertTrue(findings.isEmpty, "Apple accessibility audit found \(findings.count) issue(s); see the complete findings attachment.")
    }

}







