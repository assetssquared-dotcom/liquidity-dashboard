// api/cache-refresh.js — Vercel Cron이 2시간마다 호출
// FRED 데이터를 미리 fetch해서 Vercel KV에 저장

const SERIES = [
  { id: 'SOFR',          days: 365   },
  { id: 'EFFR',          days: 365   },
  { id: 'IORB',          days: 365   },
  { id: 'WRESBAL',       days: 730   },
  { id: 'RRPONTSYD',     days: 730   },
  { id: 'WTREGEN',       days: 730   },
  { id: 'WALCL',         days: 730   },
  { id: 'T10Y2Y',        days: 730   },
  { id: 'BAMLH0A0HYM2',  days: 730   },
  { id: 'STLFSI4',       days: 730   },
  { id: 'VIXCLS',        days: 365   },
  { id: 'WRMFNS',        days: 730   },
  { id: 'WRMFSL',        days: 730   },
];

module.exports = async function handler(req, res) {
  // Cron 인증 (Vercel이 자동으로 CRON_SECRET 헤더 추가)
  const secret = req.headers['authorization'];
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 없음' });

  // Vercel KV import
  let kv;
  try {
    const { kv: kvClient } = await import('@vercel/kv');
    kv = kvClient;
  } catch (e) {
    return res.status(500).json({ error: 'KV 사용 불가: ' + e.message });
  }

  const results = [];
  for (const { id, days } of SERIES) {
    try {
      await new Promise(r => setTimeout(r, 300)); // FRED rate limit 방지

      const start = new Date();
      start.setDate(start.getDate() - days);
      const startStr = start.toISOString().slice(0, 10);

      const url = `https://api.stlouisfed.org/fred/series/observations`
                + `?series_id=${id}&api_key=${API_KEY}&file_type=json`
                + `&observation_start=${startStr}&sort_order=asc`;

      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      if (data.error_code) throw new Error(data.error_message);

      const obs = (data.observations || []).filter(o => o.value !== '.' && o.value !== '');
      let vals = obs.map(o => parseFloat(o.value));

      // MMF 단위 변환
      if (['WRMFNS','WRMFSL'].includes(id) && vals.length > 0 && vals[vals.length-1] < 100) {
        vals = vals.map(v => +(v * 1000).toFixed(1));
      }

      const payload = { dates: obs.map(o => o.date), vals, updatedAt: Date.now() };
      await kv.set(`fred:${id}:${days}`, JSON.stringify(payload), { ex: 60 * 60 * 3 }); // 3시간 TTL
      results.push({ id, ok: true, count: vals.length });
    } catch (e) {
      results.push({ id, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, updatedAt: new Date().toISOString(), results });
};
