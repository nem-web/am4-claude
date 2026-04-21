# AM4 Control Tower — Vercel Dashboard

A serverless dashboard for Airline Manager 4 bot stats.

## Structure

```
am4-dashboard/
├── index.html          ← Frontend dashboard (served as static)
├── api/
│   ├── stats.js        ← GET  /api/stats       — fetch all data
│   └── run-bot.js      ← GET  /api/run-bot?auth=SECRET  — trigger bot
├── vercel.json
└── package.json
```

## Environment Variables (set in Vercel dashboard)

| Variable        | Description                                  |
|-----------------|----------------------------------------------|
| `MONGO_URI`     | MongoDB Atlas connection string              |
| `LOGIN_URL`     | Your AM4 auto-login URL                      |
| `TELEGRAM_TOKEN`| Telegram bot token                           |
| `CHAT_ID`       | Telegram chat ID                             |
| `CRON_SECRET`   | Secret string to protect /api/run-bot        |

## Deploy

```bash
npm i -g vercel
vercel --prod
```

## Notes

- **Bot trigger**: Hit `https://your-app.vercel.app/api/run-bot?auth=YOUR_SECRET` from cron-job.org or manually
- **Puppeteer on Vercel**: Vercel Pro supports up to 300s function timeout. Puppeteer needs the `chrome-aws-lambda` package on Vercel — swap `puppeteer` for `puppeteer-core` + `chrome-aws-lambda` if needed.
- **MongoDB Atlas**: Free tier M0 works fine. Whitelist `0.0.0.0/0` for Vercel's dynamic IPs.
- The dashboard auto-refreshes every 5 minutes.
