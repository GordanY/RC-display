# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Hosting a Local Server

### One-Click Production Server

The launcher script automatically installs dependencies (Python, Flask, Node.js), builds the frontend, and starts a Flask server on port **8080**. No manual setup required.

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

1. Finds (or installs) Python 3 and Node.js
2. Creates a Python virtual environment (`.venv/`) and installs Flask
3. Runs `npm install` and `npm run build` if `dist/` doesn't exist yet
4. Starts a Flask server serving the built frontend

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
