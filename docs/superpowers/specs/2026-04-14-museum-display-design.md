# Museum Information Display — Design Spec

## Context

A museum held an art competition where students created artworks based on 3D-printed replicas of real Chinese historical artifacts. Students recolored, decorated, and built scenes around these models. The museum purchased display boxes — large rectangular cases with four glass walls and a transparent OLED screen on one side. This web application runs fullscreen on the OLED, using black backgrounds to achieve transparency, overlaying exhibit information while visitors view the real artwork through the screen.

## Physical Setup

- **Display box**: Glass-walled case with artwork in the center
- **Screen**: Transparent OLED, 1080×1920 portrait, touchscreen
- **Transparency**: OLED black pixels are off/transparent — pure `#000000` background lets visitors see through to the artifact
- **Layout**: Information displayed on the upper half of the screen; lower half remains black/transparent

## Data Model

### Hierarchy

```
Original Artifact (historical Chinese artifact)
  └── Student Creation 1 (recolored, decorated, etc.)
  └── Student Creation 2
  └── Student Creation 3
```

One original artifact can have multiple student creations.

### Data Structure (data.json)

All asset paths are relative to `public/artifacts/`.

```json
{
  "artifacts": [
    {
      "id": "artifact-001",
      "name": { "zh": "龍紋青銅器", "en": "Dragon Bronze Vessel" },
      "period": { "zh": "商朝", "en": "Shang Dynasty" },
      "description": { "zh": "...", "en": "..." },
      "originalPhoto": "artifact-001/original-photo.jpg",
      "model": "artifact-001/model.obj",
      "creations": [
        {
          "id": "creation-001",
          "title": { "zh": "彩繪龍紋", "en": "Painted Dragon" },
          "artist": { "zh": "王小明", "en": "Wang Xiaoming" },
          "description": { "zh": "...", "en": "..." },
          "photos": [
            "artifact-001/creations/creation-001/photos/1.jpg",
            "artifact-001/creations/creation-001/photos/2.jpg"
          ],
          "video": "artifact-001/creations/creation-001/video.mp4",
          "model": "artifact-001/creations/creation-001/model.obj"
        }
      ]
    }
  ]
}
```

### File Structure

```
public/
  artifacts/
    data.json
    artifact-001/
      original-photo.jpg
      model.obj
      model.mtl
      creations/
        creation-001/
          photos/
          video.mp4
          model.obj
          model.mtl
        creation-002/
          ...
    artifact-002/
      ...
```

## Tech Stack

- **Frontend**: React + Vite
- **3D Rendering**: Three.js with OBJLoader (via React Three Fiber)
- **Styling**: Tailwind CSS with custom dark theme
- **Admin Backend**: Node.js + Express (lightweight, for file uploads and JSON editing)
- **Deployment**: `vite build` → static files served by any HTTP server (fully offline)
- **Language**: TypeScript

## Architecture

### Two Routes

| Route | Purpose | Audience |
|-------|---------|----------|
| `/` | Kiosk display (fullscreen, dark, touch-optimized) | Museum visitors |
| `/admin` | Admin panel (standard UI) | Museum staff |

### Key Libraries

- `three` + `@react-three/fiber` + `@react-three/drei` — 3D model rendering
- `tailwindcss` — styling
- `react-router-dom` — routing between kiosk and admin
- `express` + `multer` — admin file upload server
- All dependencies bundled locally for offline operation

## Kiosk Display Design

### Screen Layout (1080×1920 Portrait)

```
┌─────────────────────────┐
│  [Artifact Tabs]        │  ← Scrollable artifact selector
│  [Creation Pills]       │  ← Pill tabs for creations under selected artifact
├─────────────────────────┤
│                         │
│   Content Area          │  ← Info / 3D / Compare / Video views
│   (upper ~50%)          │
│                         │
├─────────────────────────┤
│                         │
│   BLACK / TRANSPARENT   │  ← Pure #000 — visitors see real artifact
│   (lower ~50%)          │
│                         │
│   [● ○ ○] exhibit dots  │  ← Optional position indicator
└─────────────────────────┘
```

### Navigation

- **Top bar**: Horizontally scrollable artifact tabs (one tab per original artifact). Active tab highlighted with gold (#d4af37) underline.
- **Second row**: Pill-shaped tabs for student creations under the selected artifact. Active pill filled gold.
- **Touch targets**: Minimum 44px for all interactive elements.

### Content Views

Switching between views via action buttons at the bottom of the info view:

1. **Info View** (default)
   - Title in Chinese + English
   - Artist name (CN + EN)
   - Description text (bilingual)
   - Photo thumbnail gallery (tap to enlarge)

2. **3D Model View**
   - Three.js viewport filling the content area
   - Auto-rotates by default
   - Touch: drag to orbit, pinch to zoom
   - Close button returns to info view

3. **Comparison View**
   - Slider divider between original artifact photo and student creation photo
   - Drag the divider left/right to reveal each side
   - Gold (#d4af37) slider handle

4. **Video View**
   - Video player for creation process clips
   - Play/pause, progress bar
   - Auto-plays on open, loops
   - Close button returns to info view

### Visual Design

- **Background**: Pure black (`#000000`) everywhere — critical for OLED transparency
- **Accent color**: Gold (`#d4af37`) — evokes Chinese heritage, high contrast on black
- **Text**: White/light gray on black. Chinese as primary, English as secondary
- **Typography**: System fonts with fallbacks for Chinese characters
- **Animations**: Subtle fade transitions between views. No bright flashes.

### Idle Behavior

- After 60 seconds of no touch, return to the first artifact's first creation (info view)
- Subtle fade transition back to default state
- Any touch resets the idle timer

### Language Toggle

- Toggle button in the navigation area (中/EN)
- Switches all displayed text between Chinese and English
- Implemented via React context provider

## Admin Panel

### Features

- **Artifact list**: Shows all original artifacts with creation counts
- **Add/Edit Artifact**: Form for name (CN/EN), description, period, upload original photo and 3D model
- **Creation list**: Under each artifact, shows student creations
- **Add/Edit Creation**: Form for title, artist, description (all bilingual), upload photos, video, 3D model
- **Reorder**: Drag to reorder artifacts and creations (controls display sequence)
- **Preview**: Button to open the kiosk display in a new tab

### Backend

- Lightweight Express server running locally
- Endpoints for CRUD operations on `data.json`
- File upload via `multer` to the `public/artifacts/` directory
- Only accessible on the museum's local machine

## Offline Constraints

- All assets (photos, videos, 3D models, fonts, JS/CSS) bundled locally
- No CDN dependencies — all npm packages bundled at build time
- No external API calls
- The app must work by opening `index.html` from a local HTTP server (e.g., `npx serve dist/`)

## Verification Plan

1. **Dev server**: `npm run dev` → open `http://localhost:5173` in portrait-mode browser window (1080×1920)
2. **Kiosk view**: Verify black background, touch navigation, all 4 content views
3. **3D models**: Load a sample OBJ file, verify auto-rotate and touch orbit/zoom
4. **Language toggle**: Switch between Chinese and English, verify all text updates
5. **Admin panel**: Add an artifact + creation via the admin form, verify it appears in kiosk view
6. **Offline test**: Run `npm run build`, serve the `dist/` folder with a local HTTP server, verify everything works without internet
7. **Fullscreen**: Test F11/fullscreen mode, verify no browser chrome visible
