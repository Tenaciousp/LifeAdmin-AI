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
        let done = app.toolbars.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 5))
        XCTAssertTrue(done.isHittable)
        done.tap()
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
            // The captured export sheet has Save but no visible Cancel button.
            _ = pickerControl("Save")
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
            start.press(forDuration: 0.1, thenDragTo: end)
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
        pickerControl("Browse").tap()
        if !document.waitForExistence(timeout: 5) {
            pickerControl("On My iPhone", type: .any).coordinate(
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
        // The CI runner creates a fresh disposable simulator. No customer data.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
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
        let cases: [(String, Bool, String)] = [
            ("ci-malformed.json", true, "Backup is not valid JSON."),
            ("ci-future.json", true, "Unsupported LifeAdmin backup."),
            ("ci-invalid-plan.json", true, "Invalid saved plan missing details."),
            ("ci-oversized.json", false, "Backup exceeds 5 MB.")
        ]
        for (filename, needsConfirmation, message) in cases {
            app.terminate()
            app.launch()
            XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
            selectExportedBackup(named: filename)
            if needsConfirmation { confirm(timeout: 30) }
            XCTAssertTrue(app.staticTexts[message].waitForExistence(timeout: 30), filename)
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

}

