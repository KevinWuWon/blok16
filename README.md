# Blokus Duo

A two-player Blokus Duo web game built with Nuxt 3, Nuxt UI, and Convex.

## Features

- **Blokus Duo variant**: 14×14 board with 21 pieces per player
- **Online multiplayer**: Play with a friend via shareable link
- **No authentication**: Just create a game and share the link
- **Real-time updates**: Powered by Convex's reactive database
- **Mobile responsive**: Optimized for both desktop and mobile play
- **Keyboard shortcuts**: R to rotate, F to flip pieces

## Tech Stack

- **Frontend**: Nuxt 3 + Vue 3 + Nuxt UI
- **Backend**: Convex (real-time database + serverless functions)
- **Styling**: Tailwind CSS via Nuxt UI

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure Convex

Create a Convex project and deploy the backend:

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex (or create an account)
- Create a new Convex project
- Deploy your backend functions
- Generate type definitions

### 3. Set environment variables

Copy the example env file and add your Convex URL:

```bash
cp .env.example .env
```

Edit `.env` and add your Convex deployment URL (shown after running `npx convex dev`):

```
NUXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to play!

## How to Play

1. Click "Create Game" on the home page
2. Share the game link with a friend
3. Once your friend joins, blue goes first
4. On your turn:
   - Select a piece from the tray
   - Valid placement spots are highlighted on the board
   - Click a highlighted spot to preview placement
   - Use R/F keys or buttons to rotate/flip
   - Click "Confirm" to place the piece
5. Your pieces must touch your previous pieces diagonally (at corners), but never edge-to-edge
6. The game ends when both players pass (no valid moves)
7. Winner has fewer remaining squares

## Game Rules

- **First move**: Must cover your starting position (blue at row 5, col 5; orange at row 10, col 10)
- **Corner rule**: Each new piece must touch at least one corner of your existing pieces
- **Edge rule**: Your pieces may never touch your own pieces edge-to-edge (orthogonally)
- **Opponent contact**: You can touch opponent pieces however you want
- **Passing**: If you have no valid moves, you must pass your turn
- **Winning**: Player with fewer remaining squares (total of unused piece sizes) wins

## Production

Build the application for production:

```bash
pnpm build
```

Preview production build:

```bash
pnpm preview
```

## License

MIT
