# Neeyum TradeOS — Setup Guide

TradeOS is now part of neeyum.in → accessible at neeyum.in/tradeos

## Step 1: Supabase (5 min)
1. Go to supabase.com → New Project
2. SQL Editor → paste supabase-setup.sql → Run
3. Settings → API → copy:

## Step 2: Vercel Environment Variables
Add these in Vercel → Project → Settings → Environment Variables:

| Key | Value | Where to find |
|-----|-------|---------------|
| NEXT_PUBLIC_SUPABASE_URL | https://xxx.supabase.co | Supabase → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJ... | Supabase → Settings → API → anon key |
| SUPABASE_SERVICE_KEY | eyJ... | Supabase → Settings → API → service_role key |
| ENCRYPTION_KEY | 64 hex chars | Run in Supabase SQL: SELECT encode(gen_random_bytes(32), 'hex'); |

## Step 3: Deploy
Push to GitHub → Vercel auto-deploys

## How users connect Dhan:
1. Go to neeyum.in/tradeos
2. Sign up / Login
3. Settings → Connect Broker → paste Dhan token + Client ID
4. Dhan token: dhanhq.co → Profile → API Integration → Generate Token

## Important: Dhan tokens expire every 24 hours
- Users must refresh their token daily
- All trade data saved permanently in Supabase
- Token expiry only affects live sync, not historical data

## Routes added to neeyum.in:
- /tradeos         → TradeOS app
- /api/dhan        → Dhan API proxy (server-side)
- /api/broker      → Broker token management (server-side)
