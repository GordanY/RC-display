"""Verify two artifacts show different 3D models after fix."""
import os
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 1920})

    # ── Artifact 1: Dragon Bronze Vessel ──
    print("TEST 1: Dragon Bronze Vessel (tripo_convert_...obj)")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    page.locator("button:has-text('3D Model')").click()
    page.wait_for_timeout(4000)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "two_models_1_dragon.png"))
    print("  📸 Screenshot saved")

    # Check which model URL was loaded
    model_url_1 = page.evaluate("""() => {
        const perf = performance.getEntriesByType('resource');
        const obj = perf.filter(e => e.name.endsWith('.obj'));
        return obj.map(e => e.name);
    }""")
    print(f"  Loaded OBJ URLs: {model_url_1}")

    page.locator("text=✕").click()
    page.wait_for_timeout(500)

    # ── Artifact 2: Jade Spring Vase ──
    print("\nTEST 2: Jade Spring Vase (P09.obj)")
    page.locator("text=玉壺春瓶").first.click()
    page.wait_for_timeout(500)

    page.locator("button:has-text('3D Model')").click()
    page.wait_for_timeout(4000)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "two_models_2_vase.png"))
    print("  📸 Screenshot saved")

    model_url_2 = page.evaluate("""() => {
        const perf = performance.getEntriesByType('resource');
        const obj = perf.filter(e => e.name.endsWith('.obj'));
        return obj.map(e => e.name);
    }""")
    print(f"  Loaded OBJ URLs: {model_url_2}")

    # Compare
    print("\n" + "=" * 50)
    urls_1 = set(model_url_1)
    urls_2 = set(model_url_2)
    new_urls = urls_2 - urls_1
    if new_urls:
        print(f"✅ Artifact 2 loaded a DIFFERENT model: {new_urls}")
    elif urls_1 == urls_2:
        print(f"❌ Both artifacts loaded the SAME model URLs")
    print("=" * 50)

    browser.close()
