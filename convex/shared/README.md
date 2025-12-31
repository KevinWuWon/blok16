# Shared Validation & Piece Logic

This directory contains the **single source of truth** for all Blokus game logic, including piece definitions and placement validation rules.

## Problem Solved

Previously, ~250 lines of validation logic were duplicated between:
- `lib/validation.ts` (client-side)
- `convex/games.ts` (server-side)

This duplication existed because Convex functions run in a separate runtime and couldn't import from the `lib/` directory. Maintaining two copies of the same logic was error-prone and violated DRY principles.

## Solution

All shared logic now lives in `convex/shared/`:
- **`pieces.ts`** - Piece definitions, rotations, flips, and transformations
- **`validation.ts`** - Core game rules and placement validation logic

Both client and server import from these shared modules:
- **Client** (`lib/`) re-exports from `convex/shared/` and adds client-specific UI helpers
- **Server** (`convex/games.ts`) directly imports the shared validation functions

## Architecture

```
convex/shared/          ← Single source of truth
├── pieces.ts           ← All 21 piece definitions + transformations
└── validation.ts       ← Game rules + placement validation

lib/                    ← Client-side wrappers
├── pieces.ts           ← Re-exports from convex/shared/pieces.ts
└── validation.ts       ← Re-exports + client-specific preview logic

convex/
└── games.ts            ← Server mutations/queries (imports shared logic)
```

## Benefits

1. **Single Source of Truth** - One place to update game rules
2. **Type Safety** - Shared TypeScript types between client and server
3. **Maintainability** - Changes to validation logic happen in one place
4. **No Duplication** - Eliminated ~250 lines of duplicated code
5. **Convex Compatible** - Works within Convex runtime constraints

## Files

### convex/shared/pieces.ts
- `PIECES` array (all 21 Blokus pieces)
- `normalize()`, `rotateCW()`, `rotateCCW()`, `flipH()`
- `getAllOrientations()`, `translateCells()`, `getBoundingBox()`

### convex/shared/validation.ts
- Constants: `BOARD_SIZE`, `STARTING_POSITIONS`
- Core validation: `isValidPlacement()`, `canPlacePiece()`, `hasValidMoves()`
- Helper functions: `findCornerAnchors()`, `playerToValue()`, etc.
- Game logic: `determineWinner()`, `calculateScore()`

## Usage

### Server-side (Convex)
```typescript
import { PIECES } from "./shared/pieces";
import { isValidPlacement, hasValidMoves } from "./shared/validation";
```

### Client-side (Vue)
```typescript
import { PIECES } from "@/lib/pieces";
import { isValidPlacement, hasValidMoves } from "@/lib/validation";
```

The `lib/` files act as re-export layers that maintain the existing API while sourcing from `convex/shared/`.

## Testing

Both build systems validate the shared code:
```bash
pnpm build              # Client-side TypeScript check + Vite build
npx convex typecheck    # Server-side Convex function validation
```

## Maintenance

When updating game rules or piece definitions:
1. Edit files in `convex/shared/` only
2. Run both build commands to verify
3. Changes automatically propagate to client and server
