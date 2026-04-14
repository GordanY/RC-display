"""
Verify the artifact-model fallback fix works for both cases:
1. Creation-001 (no creation.model file on disk → should fall back to artifact.model)
2. Creation-003 (has creation.model file from earlier upload → should use it directly)
"""
import os
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def screenshot(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"fix_{name}.png")
    page.screenshot(path=path)
    print(f"  📸 {path}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 1920})

    # ── Test 1: Dragon Bronze Vessel / creation-001 (artifact-level fallback) ──
    print("=" * 60)
    print("TEST 1: Dragon Bronze Vessel → creation-001 (artifact model fallback)")
    print("=" * 60)

    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Default view is artifact-001, creation-001
    model_btn = page.locator("button:has-text('3D Model')")
    print(f"  3D Model button visible: {model_btn.is_visible()}")

    if model_btn.is_visible():
        model_btn.click()
        page.wait_for_timeout(4000)  # Give OBJLoader time to fetch & parse
        screenshot(page, "1_dragon_3d_viewer")

        canvas = page.locator("canvas")
        if canvas.is_visible():
            bbox = canvas.bounding_box()
            print(f"  Canvas: {bbox['width']:.0f}x{bbox['height']:.0f}")

            # Check if model actually rendered (non-black pixels)
            pixel_check = page.evaluate("""() => {
                const canvas = document.querySelector('canvas');
                if (!canvas) return 'no canvas';
                // Create a 2D canvas to read pixels from the WebGL canvas
                const c2d = document.createElement('canvas');
                c2d.width = canvas.width;
                c2d.height = canvas.height;
                const ctx = c2d.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                const data = ctx.getImageData(0, 0, c2d.width, c2d.height).data;
                let nonBlack = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] > 10 || data[i+1] > 10 || data[i+2] > 10) nonBlack++;
                }
                return { totalPixels: data.length / 4, nonBlackPixels: nonBlack };
            }""")
            print(f"  Pixel analysis: {pixel_check}")
            if isinstance(pixel_check, dict) and pixel_check.get('nonBlackPixels', 0) > 100:
                print("  ✅ TEST 1 PASSED — Model is rendering (non-black pixels detected)")
            else:
                print("  ❌ TEST 1 FAILED — Screen is mostly black, model may not have loaded")
        else:
            print("  ❌ Canvas not visible")

        # Close viewer
        page.locator("text=✕").click()
        page.wait_for_timeout(500)
    else:
        print("  ❌ 3D Model button not visible")

    # ── Test 2: Jade Spring Vase / creation-003 (creation-level model) ──
    print("\n" + "=" * 60)
    print("TEST 2: Jade Spring Vase → creation-003 (creation-level model)")
    print("=" * 60)

    vase_tab = page.locator("text=玉壺春瓶").first
    vase_tab.click()
    page.wait_for_timeout(500)

    model_btn = page.locator("button:has-text('3D Model')")
    print(f"  3D Model button visible: {model_btn.is_visible()}")

    if model_btn.is_visible():
        model_btn.click()
        page.wait_for_timeout(4000)
        screenshot(page, "2_vase_3d_viewer")

        canvas = page.locator("canvas")
        if canvas.is_visible():
            bbox = canvas.bounding_box()
            print(f"  Canvas: {bbox['width']:.0f}x{bbox['height']:.0f}")

            pixel_check = page.evaluate("""() => {
                const canvas = document.querySelector('canvas');
                if (!canvas) return 'no canvas';
                const c2d = document.createElement('canvas');
                c2d.width = canvas.width;
                c2d.height = canvas.height;
                const ctx = c2d.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                const data = ctx.getImageData(0, 0, c2d.width, c2d.height).data;
                let nonBlack = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] > 10 || data[i+1] > 10 || data[i+2] > 10) nonBlack++;
                }
                return { totalPixels: data.length / 4, nonBlackPixels: nonBlack };
            }""")
            print(f"  Pixel analysis: {pixel_check}")
            if isinstance(pixel_check, dict) and pixel_check.get('nonBlackPixels', 0) > 100:
                print("  ✅ TEST 2 PASSED — Model is rendering")
            else:
                print("  ❌ TEST 2 FAILED — Screen is mostly black")
        else:
            print("  ❌ Canvas not visible")
    else:
        print("  ❌ 3D Model button not visible")

    # ── Test 3: creation-002 (Dragon Garden — no model at all) should NOT show button ──
    print("\n" + "=" * 60)
    print("TEST 3: Dragon Garden / creation-002 (no model at all)")
    print("=" * 60)

    dragon_tab = page.locator("text=龍紋青銅器").first
    dragon_tab.click()
    page.wait_for_timeout(500)

    # Select creation-002 (Dragon Garden)
    garden_pill = page.get_by_role("button", name="龍之庭園")
    garden_pill.click()
    page.wait_for_timeout(500)
    screenshot(page, "3_dragon_garden")

    model_btn = page.locator("button:has-text('3D Model')")
    # creation-002 has no model, but artifact-001 HAS a model → button SHOULD appear with fallback
    btn_visible = model_btn.is_visible()
    print(f"  3D Model button visible: {btn_visible}")
    if btn_visible:
        print("  ✅ TEST 3 PASSED — Artifact-level model fallback shows button for creation without model")
    else:
        print("  ❌ TEST 3 FAILED — Button should appear (artifact has model)")

    browser.close()
    print("\n" + "=" * 60)
    print("All tests complete.")
    print("=" * 60)
