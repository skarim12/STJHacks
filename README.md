# PowerPoint AI Assistant Add-in

An intelligent Microsoft PowerPoint add-in that transforms rough ideas into polished, structured presentations using AI.

## Features

- **Idea-to-Slides Generation**: Describe your presentation idea and let AI create a complete slide deck
- **Smart Content Structuring**: Automatic organization of content into appropriate slide types
- **Research Assistant**: Built-in research capabilities for adding facts and statistics
- **Color Theme Management**: Apply color themes across slides
- **Speaker Notes**: Automatic generation of speaker notes and export

## Prerequisites

- **Node.js**: 16+ (18+ recommended)
- **npm**
- **Microsoft PowerPoint**: Desktop (Microsoft 365)
- **Anthropic API key**: from https://console.anthropic.com

## Project Structure

```
.
├── src/
│   ├── taskpane/             # React taskpane UI
│   ├── commands/             # Office ribbon commands
│   └── manifest.xml          # Office add-in manifest (copied to dist)
├── backend/                  # Node/Express proxy for Anthropic
├── assets/                   # Icons
├── webpack.config.js
├── package.json
├── tsconfig.json
└── README.md
```

## Development Setup (Current Repo Layout)

You do **not** need to run `yo office` unless you want scaffolding. This repo already follows the layout expected by the code.

### 1) Install dependencies

On this machine, PowerShell may resolve `npm` to a broken stub. Use the real npm:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" --prefix backend install
```

### 2) Configure backend environment

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
PORT=4000
```

### 3) Run everything (single command)

From the project root:

```powershell
python run_dev.py
```

That will:
- install dependencies (root + backend)
- start backend on `:4000`
- start frontend dev server on `:3000`

If you ever need to run them separately:

```bash
cd backend
npm run dev

cd ..
npm run start
```

The dev server hosts:
- Taskpane: https://localhost:3000/taskpane.html
- Commands: https://localhost:3000/commands.html
- Manifest (copied): https://localhost:3000/manifest.xml

### 4) Run in PowerPoint (Desktop)

#### Option A: VS Code (recommended)

1. Install the VS Code extension **Microsoft Office Add-in Debugger** (ms-office.officedebugger)
2. In VS Code → Run and Debug → select **PowerPoint: Debug Add-in (Office Debugger)**
3. Press **F5**

This starts the dev servers and launches PowerPoint with the add-in sideloaded.

#### Option B: Manual sideload

In PowerPoint (desktop):
- Insert → Get Add-ins → My Add-ins → Upload My Add-in
- Select **`${repo}\manifest.xml`** (repo root)

PowerPoint will add an **AI Assistant** button on the Home tab that opens the taskpane.

## Notes

- Frontend calls the backend at `http://localhost:4000/api` by default (see `src/taskpane/services/AIService.ts`).
- If you want to make the backend URL configurable at build time, you can add a `DefinePlugin` constant in `webpack.config.js`.
