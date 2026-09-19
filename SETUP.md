# TradeLog — Setup Guide

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, fill in the details
3. Wait for the project to provision (~2 min)

### 2. Run the Database Schema

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

This creates:
- `trades` table with full trade fields + RLS policies
- `journal_notes` table with mood tracking + RLS policies
- Performance indexes

### 3. Enable Google OAuth

1. Supabase dashboard → **Authentication** → **Providers** → **Google** → Enable
2. Go to [Google Cloud Console](https://console.cloud.google.com)
3. Create a project → **APIs & Services** → **Credentials** → **OAuth 2.0 Client ID**
4. Set **Authorized redirect URI** to:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
5. Copy **Client ID** and **Client Secret** back into Supabase Google provider settings

### 4. Configure the App

Open `js/config.js` and replace the placeholder values:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

Find these in: Supabase → **Settings** → **API** → **Project URL** and **anon public key**

### 5. Serve the App

Because the app uses ES Modules, it needs an HTTP server (not `file://`).

**Option A — VS Code Live Server extension:**
- Right-click `index.html` → Open with Live Server

**Option B — Python:**
```bash
cd trading-journal
python -m http.server 8080
```

**Option C — Node.js:**
```bash
npx serve trading-journal
```

Then open `http://localhost:8080/trading-journal/`

---

## Features

| Feature | Description |
|---------|-------------|
| 🔐 Auth | Google OAuth + Email/Password sign in/up/forgot |
| 📅 PNL Calendar | Monthly calendar heatmap — green/red cells by daily P&L |
| 📋 Trade Log | Full trade table with sort, filter, search |
| ➕ Add Trade | Modal form: symbol, side, prices, qty, setup, grade, emotion, notes |
| 📊 Statistics | Equity curve, win/loss bars, P&L by symbol/setup/day-of-week |
| 📝 Journal | Daily notes editor with mood tracking |
| 🌙 Dark Theme | Terminal-style dark UI matching TradingView aesthetics |

## Trade Fields

- Symbol, Date, Side (Long/Short)
- Entry, Exit, Stop Loss, Take Profit prices
- Quantity
- P&L (auto-calculated or manual)
- R:R ratio (auto-calculated from SL/TP)
- Setup / Strategy (with autocomplete suggestions)
- Session (Pre-Market, Regular, After-Hours)
- Execution Grade (A–F)
- Emotion (Calm, Confident, Fearful, FOMO, Revenge...)
- Screenshot URL
- Notes

## Project Structure

```
trading-journal/
├── index.html              # App entry point
├── css/
│   └── main.css            # All styles (dark theme)
├── js/
│   ├── config.js           # Supabase credentials ← EDIT THIS
│   ├── app.js              # Bootstrap + global events
│   ├── auth.js             # Auth UI + Supabase auth
│   ├── router.js           # Hash-based SPA router
│   ├── db.js               # All Supabase DB calls
│   ├── modal.js            # Add/Edit trade modal
│   ├── utils.js            # Formatters, helpers, toast
│   └── pages/
│       ├── dashboard.js    # Dashboard + equity chart
│       ├── calendar.js     # PNL calendar heatmap
│       ├── trades.js       # Trade log table
│       ├── stats.js        # Statistics + charts
│       └── journal.js      # Journal notes editor
└── supabase/
    └── schema.sql          # DB schema + RLS policies
```
