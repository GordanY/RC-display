"""
Playwright test: Upload a 3D model to a creation via the admin panel,
then verify the 3D model preview works in the kiosk view.

Target: sample-artifact-002 → creation-003 (Starry Glaze Vase)
which currently has NO 3D model — clean end-to-end test.
"""

import os
import sys
from playwright.sync_api import sync_playwright

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_FILE = os.path.join(PROJECT_DIR, "testing", "model.obj")
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "testing", "screenshots")

ADMIN_URL = "http://localhost:5173/admin"
KIOSK_URL = "http://localhost:5173"


def ensure_dirs():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


def screenshot(page, name, step):
    path = os.path.join(SCREENSHOTS_DIR, f"{step:02d}_{name}.png")
    page.screenshot(path=path)
    print(f"  📸 Screenshot saved: {path}")


def test_upload_and_preview():
    ensure_dirs()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        # ────────────────────────────────────────────
        # STEP 1: Navigate to admin panel
        # ────────────────────────────────────────────
        print("\n[Step 1] Navigating to admin panel...")
        page.goto(ADMIN_URL)
        page.wait_for_load_state("networkidle")
        screenshot(page, "admin_loaded", 1)

        # Verify admin page loaded
        header = page.locator("text=Museum Display — Admin")
        assert header.is_visible(), "Admin header not found"
        print("  ✅ Admin panel loaded")

        # ────────────────────────────────────────────
        # STEP 2: Expand creations for artifact-002 (Jade Spring Vase)
        # ────────────────────────────────────────────
        print("\n[Step 2] Expanding creations for Jade Spring Vase...")
        # Find the artifact-002 card — it contains "玉壺春瓶" or "Jade Spring Vase"
        artifact_cards = page.locator(".bg-gray-900.rounded-lg")
        # The second card is artifact-002
        artifact_002_card = artifact_cards.nth(1)
        assert artifact_002_card.is_visible(), "Artifact-002 card not found"

        # Click "Creations" button to expand (use role to avoid matching "1 creations" text)
        creations_btn = artifact_002_card.get_by_role("button", name="Creations")
        creations_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, "creations_expanded", 2)
        print("  ✅ Creations list expanded")

        # ────────────────────────────────────────────
        # STEP 3: Click Edit on creation-003 (Starry Glaze Vase)
        # ────────────────────────────────────────────
        print("\n[Step 3] Opening creation-003 for editing...")
        # Find creation-003 — look for "星空釉瓶" text then find Edit button nearby
        creation_003 = artifact_002_card.locator(".bg-gray-800\\/50").first
        edit_btn = creation_003.locator("text=Edit")
        edit_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, "creation_form_open", 3)
        print("  ✅ Creation form opened")

        # ────────────────────────────────────────────
        # STEP 4: Upload the 3D model file
        # ────────────────────────────────────────────
        print("\n[Step 4] Uploading 3D model...")
        assert os.path.exists(MODEL_FILE), f"Model file not found: {MODEL_FILE}"
        print(f"  Model file: {MODEL_FILE} ({os.path.getsize(MODEL_FILE) / 1024 / 1024:.1f} MB)")

        # Find the 3D model file input — it's the one with accept=".obj,.mtl"
        model_input = artifact_002_card.locator('input[accept=".obj,.mtl"]')
        model_input.set_input_files(MODEL_FILE)

        # Wait for upload to complete — look for "uploaded" text to appear
        uploaded_indicator = artifact_002_card.locator("text=uploaded")
        uploaded_indicator.wait_for(state="visible", timeout=30000)
        screenshot(page, "model_uploaded", 4)
        print("  ✅ Model file uploaded successfully")

        # ────────────────────────────────────────────
        # STEP 5: Save the creation
        # ────────────────────────────────────────────
        print("\n[Step 5] Saving creation...")
        # Find the Save button inside the creation form area
        save_btn = artifact_002_card.locator("button:has-text('Save')").first
        save_btn.click()

        # Wait for save to complete — the "Saving..." indicator may flash briefly
        page.wait_for_timeout(2000)
        screenshot(page, "creation_saved", 5)
        print("  ✅ Creation saved")

        # ────────────────────────────────────────────
        # STEP 6: Navigate to kiosk view
        # ────────────────────────────────────────────
        print("\n[Step 6] Navigating to kiosk view...")
        page.set_viewport_size({"width": 1080, "height": 1920})
        page.goto(KIOSK_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        screenshot(page, "kiosk_loaded", 6)
        print("  ✅ Kiosk loaded")

        # ────────────────────────────────────────────
        # STEP 7: Select artifact-002 tab (Jade Spring Vase)
        # ────────────────────────────────────────────
        print("\n[Step 7] Selecting Jade Spring Vase artifact...")
        # Click on the "玉壺春瓶" tab
        vase_tab = page.locator("text=玉壺春瓶")
        vase_tab.click()
        page.wait_for_timeout(500)
        screenshot(page, "artifact_002_selected", 7)
        print("  ✅ Jade Spring Vase selected")

        # ────────────────────────────────────────────
        # STEP 8: Verify "3D Model" button appears
        # ────────────────────────────────────────────
        print("\n[Step 8] Checking for 3D Model button...")
        model_btn = page.locator("button:has-text('3D Model')")
        model_visible = model_btn.is_visible()
        screenshot(page, "check_3d_button", 8)

        if model_visible:
            print("  ✅ 3D Model button is visible!")
        else:
            print("  ❌ 3D Model button NOT visible — model field may not have saved")
            # Take a diagnostic screenshot and print page content
            content = page.content()
            print(f"  Page content length: {len(content)} chars")
            browser.close()
            return False

        # ────────────────────────────────────────────
        # STEP 9: Click 3D Model button and check preview
        # ────────────────────────────────────────────
        print("\n[Step 9] Opening 3D model viewer...")
        model_btn.click()
        # Give Three.js time to load the OBJ model and render
        page.wait_for_timeout(3000)
        screenshot(page, "3d_viewer_open", 9)

        # ────────────────────────────────────────────
        # STEP 10: Verify the 3D viewer rendered
        # ────────────────────────────────────────────
        print("\n[Step 10] Verifying 3D model preview...")

        # Check for the canvas element (Three.js renders into a <canvas>)
        canvas = page.locator("canvas")
        canvas_visible = canvas.is_visible()

        # Check for the "3D Model" label overlay
        label = page.locator("text=3D Model").first
        label_visible = label.is_visible()

        # Check for the "Drag to rotate" helper text
        helper = page.locator("text=Drag to rotate")
        helper_visible = helper.is_visible()

        # Check for the close button
        close_btn = page.locator("text=✕")
        close_visible = close_btn.is_visible()

        screenshot(page, "3d_viewer_final", 10)

        print(f"  Canvas element visible: {'✅' if canvas_visible else '❌'} {canvas_visible}")
        print(f"  '3D Model' label visible: {'✅' if label_visible else '❌'} {label_visible}")
        print(f"  'Drag to rotate' text visible: {'✅' if helper_visible else '❌'} {helper_visible}")
        print(f"  Close button visible: {'✅' if close_visible else '❌'} {close_visible}")

        # Check canvas dimensions (should have non-zero size if rendering)
        if canvas_visible:
            bbox = canvas.bounding_box()
            if bbox:
                print(f"  Canvas size: {bbox['width']:.0f} x {bbox['height']:.0f}")
                if bbox['width'] > 0 and bbox['height'] > 0:
                    print("  ✅ Canvas has non-zero dimensions — 3D viewer is rendering!")
                else:
                    print("  ❌ Canvas has zero dimensions")

        # Also check for any console errors related to model loading
        # (We can't directly check console in sync API, but we can check
        #  if the model loaded by evaluating Three.js scene state)

        # ────────────────────────────────────────────
        # STEP 11: Test interaction (close button)
        # ────────────────────────────────────────────
        print("\n[Step 11] Testing close button...")
        if close_visible:
            close_btn.click()
            page.wait_for_timeout(500)
            screenshot(page, "viewer_closed", 11)
            # Should be back to info view
            info_visible = page.get_by_role("heading", name="星空釉瓶").is_visible() or page.get_by_role("heading", name="Starry Glaze Vase").is_visible()
            print(f"  Back to info view: {'✅' if info_visible else '❌'} {info_visible}")

        # ────────────────────────────────────────────
        # Summary
        # ────────────────────────────────────────────
        all_pass = canvas_visible and label_visible and helper_visible and close_visible
        print("\n" + "=" * 50)
        if all_pass:
            print("✅ ALL CHECKS PASSED — 3D model preview works!")
        else:
            print("❌ SOME CHECKS FAILED — see details above")
        print("=" * 50)
        print(f"\nScreenshots saved to: {SCREENSHOTS_DIR}/")

        browser.close()
        return all_pass


if __name__ == "__main__":
    success = test_upload_and_preview()
    sys.exit(0 if success else 1)
