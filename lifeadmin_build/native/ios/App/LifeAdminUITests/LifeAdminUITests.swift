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
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "Accessibility tree on failure"
            tree.lifetime = .keepAlways
            add(tree)
        }
        app.terminate()
    }

    private func reveal(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        for _ in 0..<14 {
            if element.exists && element.isHittable { return }
            app.webViews.firstMatch.swipeUp()
        }
        XCTFail("Control is not reachable: \(element)", file: file, line: line)
    }

    private func confirm() {
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        alert.buttons["OK"].tap()
    }

    func testBillAndPlanSurviveRestartAndDeletionPersists() throws {
        // The CI runner creates a fresh disposable simulator. No customer data.
        app.launch()
        XCTAssertTrue(app.buttons["Search"].waitForExistence(timeout: 20))
        let search = app.textFields.firstMatch
        search.tap()
        search.typeText("Cancel Netflix")
        app.buttons["Search"].tap()
        XCTAssertTrue(app.buttons["Use suggestion"].waitForExistence(timeout: 5))
        app.buttons["Use suggestion"].tap()

        let billName = app.textFields.matching(NSPredicate(format:
            "label == %@ OR placeholderValue == %@", "Bill name", "Optional name")).firstMatch
        reveal(billName)
        billName.tap()
        billName.typeText("CI sample subscription")
        let done = app.toolbars.buttons["Done"]
        if done.exists { done.tap() }
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
        XCTAssertTrue(app.staticTexts["Saved plans (1)"].exists)
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
        let empty = app.staticTexts["Your bills (0)"]
        reveal(empty)
        XCTAssertTrue(app.staticTexts["Saved plans (0)"].exists)
        XCTAssertFalse(app.buttons["Open plan"].exists)
    }
}
