"""
Diagnostic: Check what the user sees at http://localhost:5173/
and capture exactly what's needed to view the 3D model.
"""
import os
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def screenshot(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"diag_{name}.png")
    page.screenshot(path=path)
    print(f"  📸 {path}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 1920})

    # Step 1: Load kiosk — default state
    print("[1] Loading kiosk default view...")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    screenshot(page, "1_default_view")

    # Check which artifact is selected by default
    print(f"  Page title content check...")

    # Check if 3D Model button visible on default view
    model_btn = page.locator("button:has-text('3D Model')")
    print(f"  3D Model button visible on default view: {model_btn.is_visible()}")

    # Step 2: Click on "玉壺春瓶" tab (Jade Spring Vase — our uploaded model)
    print("\n[2] Clicking on 玉壺春瓶 (Jade Spring Vase) tab...")
    vase_tab = page.locator("text=玉壺春瓶")
    if vase_tab.count() > 0:
        vase_tab.first.click()
        page.wait_for_timeout(500)
        screenshot(page, "2_vase_selected")

        # Check for 3D Model button
        model_btn = page.locator("button:has-text('3D Model')")
        print(f"  3D Model button visible: {model_btn.is_visible()}")

        if model_btn.is_visible():
            # Step 3: Click 3D Model button
            print("\n[3] Clicking 3D Model button...")
            model_btn.click()
            page.wait_for_timeout(3000)
            screenshot(page, "3_3d_viewer")

            # Check canvas
            canvas = page.locator("canvas")
            if canvas.is_visible():
                bbox = canvas.bounding_box()
                print(f"  ✅ Canvas visible: {bbox['width']:.0f}x{bbox['height']:.0f}")

                # Check if canvas has any rendered content by checking pixel data
                pixel_check = page.evaluate("""() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return { error: 'no canvas' };
                    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
                    if (!ctx) return { error: 'no webgl context' };
                    const pixels = new Uint8Array(4);
                    // Read a pixel from center of canvas
                    const cx = Math.floor(canvas.width / 2);
                    const cy = Math.floor(canvas.height / 2);
                    ctx.readPixels(cx, cy, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
                    return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3], w: canvas.width, h: canvas.height };
                }""")
                print(f"  Canvas pixel check (center): {pixel_check}")

                # Also check console for errors
                page.on("console", lambda msg: print(f"  Console [{msg.type}]: {msg.text}") if msg.type == "error" else None)
            else:
                print("  ❌ Canvas NOT visible")
        else:
            print("  ❌ 3D Model button NOT visible — checking data...")
            # Check what data the page actually loaded
            data_check = page.evaluate("""() => {
                return fetch('/artifacts/data.json').then(r => r.json()).then(d => {
                    const a002 = d.artifacts.find(a => a.id === 'sample-artifact-002');
                    if (!a002) return 'artifact-002 not found';
                    const c003 = a002.creations.find(c => c.id === 'creation-003');
                    if (!c003) return 'creation-003 not found';
                    return { model: c003.model, hasModel: !!c003.model };
                });
            }""")
            print(f"  Data check: {data_check}")
    else:
        print("  ❌ 玉壺春瓶 tab not found!")

    # Step 4: Also check the first artifact's creation-001 (which has model in data but file may be missing)
    print("\n[4] Checking Dragon Bronze Vessel / creation-001...")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Default is artifact-001, creation-001
    model_btn = page.locator("button:has-text('3D Model')")
    print(f"  3D Model button visible for creation-001: {model_btn.is_visible()}")

    if model_btn.is_visible():
        model_btn.click()
        page.wait_for_timeout(3000)
        screenshot(page, "4_creation001_3d")
        canvas = page.locator("canvas")
        print(f"  Canvas visible: {canvas.is_visible()}")
        if canvas.is_visible():
            bbox = canvas.bounding_box()
            print(f"  Canvas size: {bbox['width']:.0f}x{bbox['height']:.0f}")

    # Step 5: Verify model files exist from browser perspective
    print("\n[5] Checking model file accessibility from browser...")
    responses = {}
    for path in [
        "/artifacts/sample-artifact-002/creations/creation-003/model.obj",
        "/artifacts/sample-artifact-001/creations/creation-001/model.obj",
    ]:
        status = page.evaluate(f"""() => fetch('{path}', {{method: 'HEAD'}}).then(r => r.status).catch(e => e.message)""")
        responses[path] = status
        print(f"  {path} → HTTP {status}")

    browser.close()
    print("\nDone.")
