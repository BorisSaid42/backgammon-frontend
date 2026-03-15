# Backgammon Club

Multiplayer backgammon with SOL wagering via Phantom wallet.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — Phantom wallet extension required for SOL games.

## Environment Variables

Copy `.env` and fill in your values:

| Variable | Description |
|---|---|
| `VITE_HELIUS_RPC` | Helius RPC URL (devnet or mainnet) |
| `VITE_HOUSE_WALLET` | Public key of the house wallet that holds wagers |
| `VITE_DRY_RUN` | Set to `true` to skip real transactions |
| `VITE_SYNC_URL` | (Optional) Sync server URL for cross-browser play |

## Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Set environment variables in Railway dashboard
4. Railway auto-detects Vite via `nixpacks.toml`

## Testing

- **DRY_RUN=true**: Test all UI flows without Phantom/SOL
- **Devnet**: Switch Phantom to devnet, use devnet Helius RPC, airdrop SOL at solfaucet.com
- **Two players locally**: Open two browser tabs (localStorage syncs between them)
- **Two players cross-device**: Deploy to Railway or set up a VITE_SYNC_URL

## Multiplayer Sync

By default, game state syncs via `localStorage` (same browser only).
For cross-browser/device play, you need a simple key-value sync server.
Set `VITE_SYNC_URL` to enable it. The server needs two endpoints:

- `GET /get?key=xxx` → returns `{ value: "..." }`
- `POST /set` with body `{ key, value }` → stores it

## Payout Distribution

The house wallet accumulates wagers. When a game ends, the `payouts` array
in the lobby state records the winner's wallet and amount. You need a
backend script to process these payouts from the house wallet.
