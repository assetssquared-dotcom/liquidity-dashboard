// api/fred.js — KV 캐시 우선, 없으면 FRED 직접 호출
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 필요' });

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 없음' });

  // 1. Vercel KV에서 먼저 조회
  try {
    const { kv } = await import('@vercel/kv');
    const cached = await kv.get(`fred:${series}:${days}`);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (data.dates && data.dates.length > 0) {
        return res.status(200).json(data);
      }
    }
  } catch (e) {
    // KV 없으면 그냥 FRED 직접 호출
  }

  // 2. KV 없으면 FRED 직접 호출
  const start = new Date();
  start.setDate(start.getDate() - (parseInt(days) || 365));
  const startStr = start.toISOString().slice(0, 10);

  const url = `https://api.stlouisfed.org/fred/series/observations`
            + `?series_id=${series}&api_key=${API_KEY}&file_type=json`
            + `&observation_start=${startStr}&sort_order=asc`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FRED 오류: ${r.status}`);
    const data = await r.json();
    if (data.error_code) throw new Error(data.error_message);

    const obs = (data.observations || []).filter(o => o.value !== '.' && o.value !== '');
    let vals = obs.map(o => parseFloat(o.value));

    const MMF = ['WRMFNS', 'WRMFSL'];
    if (MMF.includes(series.toUpperCase()) && vals.length > 0 && vals[vals.length-1] < 100) {
      vals = vals.map(v => +(v * 1000).toFixed(1));
    }

    return res.status(200).json({ dates: obs.map(o => o.date), vals });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
