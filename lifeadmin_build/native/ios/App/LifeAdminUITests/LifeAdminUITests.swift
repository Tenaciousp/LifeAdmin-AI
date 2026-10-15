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

    private func confirm() {
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        let accept = alert.buttons.matching(NSPredicate(format: "label ==[c] %@", "OK")).firstMatch
        XCTAssertTrue(accept.waitForExistence(timeout: 5))
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

    private func cancelFilePicker() {
        // Apple exposes Cancel with different roles and duplicate containers.
        // Wait for the actionable match rather than the first labelled wrapper.
        let candidates = app.descendants(matching: .any).matching(
            NSPredicate(format: "label == %@", "Cancel"))
        let reachable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            candidates.allElementsBoundByIndex.contains { $0.isHittable }
        }, object: nil)
        guard XCTWaiter.wait(for: [reachable], timeout: 10) == .completed,
              let cancel = candidates.allElementsBoundByIndex.first(where: { $0.isHittable }) else {
            print("Backup picker controls:\n" + app.debugDescription)
            XCTFail("Native backup picker Cancel control was not found")
            return
        }
        XCTAssertTrue(cancel.isHittable)
        cancel.tap()
        XCTAssertTrue(app.staticTexts[
            "Backup action cancelled. Existing records are unchanged."
        ].waitForExistence(timeout: 10))
    }

    func testBillAndPlanSurviveRestartAndDeletionPersists() throws {
        // The CI runner creates a fresh disposable simulator. No customer data.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let search = app.textFields.firstMatch
        search.tap()
        dismissKeyboardTutorial()
        search.typeText("Cancel Netflix")
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
        billName.typeText("CI sample subscription")
        XCTAssertEqual(billName.value as? String, "CI sample subscription")
        closeKeyboard()
        let save = app.buttons["Save bill"]
        reveal(save)
        save.tap()
        XCTAssertTrue(app.staticTexts["Bill saved on this device."].waitForExistence(timeout: 10))

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
        cancelFilePicker()

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
    }
}
