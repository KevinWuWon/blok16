# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start Vite dev server (http://localhost:5173)
pnpm build            # Build for production (runs vue-tsc then vite build)
pnpm preview          # Preview production build
pnpm lint             # Run ESLint
pnpm typecheck        # Run vue-tsc --noEmit
npx convex dev        # Start Convex dev server (deploys functions, generates types)
npx convex typecheck  # Typecheck Convex functions only
```

## Architecture

This is a two-player Blokus Duo game with Vite + Vue 3 frontend and Convex backend.

### Frontend (src/)
- **views/HomeView.vue**: Home page with "Create Game" button
- **views/GameView.vue**: Main game page - contains all game logic, piece selection, placement preview, and controls
- **components/Board.vue**: 14×14 grid renderer with placement highlighting
- **components/PieceTray.vue**: Displays available pieces for selection
- **components/PieceMiniPreview.vue**: Small piece preview in tray and controls
- **router/index.ts**: Vue Router configuration
- **main.ts**: App entry point, initializes Convex via convex-vue

### Backend (convex/)
- **schema.ts**: Defines `games` table with board state, players, pieces, turn management
- **games.ts**: All mutations (createGame, joinGame, placePiece, passTurn) and queries (getGame)
- Validation logic is duplicated in games.ts (can't import from lib in Convex runtime)

### Shared Logic (lib/)
- **pieces.ts**: 21 Blokus piece definitions with rotation/flip transforms
- **validation.ts**: Placement validation, corner anchor detection, valid move checking

### Key Data Flow
1. Player creates game → `createGame` mutation → returns 6-char code
2. Player 2 joins via link → `joinGame` mutation → game status becomes "playing"
3. On turn: select piece → click valid anchor → preview appears → confirm → `placePiece` mutation
4. Real-time sync via convex-vue's reactive queries

### Game Rules (14×14 Blokus Duo)
- Starting positions: blue (4,4), orange (9,9) - 0-indexed
- First move must cover starting position
- Subsequent pieces must touch own piece diagonally, never orthogonally
- Game ends when both players pass; lowest remaining squares wins
