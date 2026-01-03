# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start Vite dev server (http://localhost:5173)
pnpm build            # Build for production (runs vue-tsc then vite build)
pnpm preview          # Preview production build
pnpm lint             # Run ESLint
pnpm typecheck        # Run vue-tsc --noEmit
pnpm test             # Run Vitest in watch mode
pnpm test:run         # Run Vitest once
npx convex dev        # Start Convex dev server (deploys functions, generates types)
npx convex typecheck  # Typecheck Convex functions only
```

## Architecture

This is a two-player Blokli game with Vite + Vue 3 frontend and Convex backend.

### Frontend (src/)
- **views/HomeView.vue**: Home page with "Create Game" button, shows active games
- **views/GameView.vue**: Main game page - orchestrates composables, renders board and piece trays
- **components/Board.vue**: 14×14 grid renderer with placement highlighting
- **components/PieceTray.vue**: Displays available pieces for selection
- **components/PieceMiniPreview.vue**: Small piece preview in tray and controls
- **components/RoleSelectionDialog.vue**: Dialog for choosing player role when joining
- **components/TakeoverConfirmDialog.vue**: Confirmation dialog for taking over a player slot
- **router/index.ts**: Vue Router configuration
- **main.ts**: App entry point, initializes Convex via convex-vue

### Composables (src/composables/)
Game logic is extracted into focused composables:
- **useGameState.ts**: Core game state (game data, player info, turn state)
- **useGameRole.ts**: Role selection and persistence (IndexedDB-backed)
- **useGameFlow.ts**: Game lifecycle (joining, passing, status transitions)
- **useGameInteraction.ts**: Piece selection, rotation, flipping, placement confirmation
- **usePieceDrag.ts**: Drag-and-drop piece placement on mobile/desktop
- **usePlacement.ts**: Placement preview and anchor detection
- **useNotifications.ts**: Push notification handling
- **useStorage.ts**: IndexedDB wrapper for persistent client state

### Backend (convex/)
- **schema.ts**: Defines `games` table with board state, players, pieces, turn management
- **games.ts**: All mutations (createGame, joinGame, placePiece, passTurn) and queries (getGame)
- **push.ts / pushActions.ts**: Push notification subscription and delivery
- **http.ts**: HTTP endpoints for push notification callbacks
- **shared/**: Single source of truth for game logic (used by both client and server)
  - **pieces.ts**: 21 piece definitions with rotation/flip transforms
  - **validation.ts**: Placement validation, corner anchor detection, valid move checking

### Client Wrappers (lib/)
- **pieces.ts**: Re-exports from convex/shared/pieces.ts
- **validation.ts**: Re-exports shared validation + adds client-specific helpers

### Key Data Flow
1. Player creates game → `createGame` mutation → returns 6-char code
2. Player 2 joins via link or code → `joinGame` mutation → game status becomes "playing"
3. On turn: select piece → click/drag to valid anchor → preview appears → confirm → `placePiece` mutation
4. Real-time sync via convex-vue's reactive queries
5. Push notifications alert players when it's their turn

### Game Rules (14×14 Blokli)
- Starting positions: blue (4,4), orange (9,9) - 0-indexed
- First move must cover starting position
- Subsequent pieces must touch own piece diagonally, never orthogonally
- Game ends when both players pass; lowest remaining squares wins
