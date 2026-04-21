import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

// ── Schema ──────────────────────────────────────────────────────────────────
const transactionSchema = new mongoose.Schema({
  type:      { type: String, enum: ["fuel", "co2", "income", "expense"], required: true },
  label:     String,
  amount:    Number,   // $ amount (positive = income, negative = expense)
  price:     Number,   // per-1000 price if fuel/co2
  quantity:  Number,   // units bought if fuel/co2
  aircraft:  String,   // aircraft ID / route if applicable
  timestamp: { type: Date, default: Date.now },
});

const memorySchema = new mongoose.Schema({
  _id:             { type: String, default: "singleton" },
  cash:            Number,
  time:            Number,
  lastFuel:        Number,
  lastCO2:         Number,
  lastBoostReport: Number,
});

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
const Memory      = mongoose.models.Memory      || mongoose.model("Memory",      memorySchema);

// ── DB connect (cached for serverless) ──────────────────────────────────────
let cached = global._mongoConn;
async function connect() {
  if (cached) return cached;
  cached = await mongoose.connect(MONGO_URI);
  global._mongoConn = cached;
  return cached;
}

// ── Helper ───────────────────────────────────────────────────────────────────
function since24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    await connect();

    const memory = await Memory.findById("singleton").lean() || {};

    // All transactions last 7 days for the table
    const allTx = await Transaction.find({
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ timestamp: -1 }).lean();

    // 24h aggregation
    const tx24h = allTx.filter(t => new Date(t.timestamp) >= since24h());

    const income24h   = tx24h.filter(t => t.type === "income")  .reduce((s, t) => s + (t.amount || 0), 0);
    const expense24h  = tx24h.filter(t => t.type !== "income")  .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const fuelSpend   = tx24h.filter(t => t.type === "fuel")    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const co2Spend    = tx24h.filter(t => t.type === "co2")     .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

    // Per-aircraft earnings (group by aircraft field)
    const aircraftMap = {};
    allTx.filter(t => t.aircraft && t.type === "income").forEach(t => {
      aircraftMap[t.aircraft] = (aircraftMap[t.aircraft] || 0) + (t.amount || 0);
    });
    const perAircraft = Object.entries(aircraftMap)
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total);

    // Profit/hr from memory
    let profitPerHour = 0;
    if (memory.cash && memory.time) {
      const diffTime = (Date.now() - memory.time) / 3600000;
      // We'll use a rough estimate from 24h income
      profitPerHour = diffTime > 0 ? Math.floor(income24h / Math.max(diffTime, 1)) : 0;
    }

    res.status(200).json({
      cash:         memory.cash  || 0,
      lastFuel:     memory.lastFuel  || null,
      lastCO2:      memory.lastCO2   || null,
      lastUpdated:  memory.time  || null,
      profitPerHour,
      income24h,
      expense24h,
      fuelSpend,
      co2Spend,
      net24h: income24h - expense24h,
      perAircraft,
      transactions: allTx.slice(0, 200),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
