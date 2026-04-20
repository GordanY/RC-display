# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Hosting a Local Server

### One-Click Production Server

The launcher script automatically checks and installs all dependencies (Python, Flask, Node.js), builds the frontend, and starts a Flask server on port **8080**. No manual setup required — works on a completely fresh PC.

#### Mac / Linux

```bash
chmod +x start.sh   # first time only
./start.sh
```

#### Windows

Double-click **`start.bat`**, or run it from Command Prompt:

```cmd
start.bat
```

#### What it does

1. Finds (or extracts) Python 3 — tries PATH, common install locations, or extracts the bundled tarball from `tools/`. Falls back to winget / python.org if the tarball is missing
2. Finds (or extracts) Node.js — tries PATH or extracts the bundled zip from `tools/`
3. Creates a Python virtual environment (`.venv/`) and installs Flask
4. Runs `npm install` and `npm run build` if `dist/` doesn't exist yet
5. Displays a pre-flight check summary of all dependencies
6. Starts a Flask server serving the built frontend
7. Auto-opens the browser to `http://localhost:8080`

All output is logged to `logs/start_YYYYMMDD_HHMMSS.log` for troubleshooting. The last 10 log files are kept automatically.

#### URLs

| Page | URL |
|------|-----|
| Kiosk Display | http://localhost:8080/ |
| Admin Panel | http://localhost:8080/admin |

Press **Ctrl+C** in the terminal to stop the server.

### Development Server

For local development with hot-reload, you need [Node.js](https://nodejs.org/) installed.

```bash
npm install          # install dependencies (first time only)
npm run dev:all      # starts both Vite dev server and Express backend
```

This runs two servers concurrently:

- **Vite dev server** (`npm run dev`) — frontend with hot module replacement
- **Express backend** (`npm run server`) — API server

You can also run them individually:

```bash
npm run dev      # frontend only
npm run server   # backend only
```

### Transferring to Another PC

Source code lives in git; **uploaded content does not**. `public/artifacts/` (3D models, textures, student creations, and the `data.json` manifest) is gitignored and must be copied out-of-band.

To set up another PC:

1. `git clone` the repo (or `git pull` if it already exists)
2. Copy `public/artifacts/` from the source PC via USB / rsync / network share
3. Run `start.bat` (Windows) or `./start.sh` (macOS/Linux) — it will auto-install Python, Node.js, and project dependencies on first run, then build and launch

On Windows, the Python and Node.js runtimes are bundled under `tools/` and extract locally on first run — no admin rights or installer needed. First-run internet is only required for `pip install flask` (~2 MB) and `npm install`. On macOS/Linux, first run installs Node.js via Homebrew / apt (Python is expected to be present). On subsequent runs, start-up is offline-capable. When source code changes (e.g. after `git pull`), `start.py` detects the staleness and rebuilds the frontend automatically.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
