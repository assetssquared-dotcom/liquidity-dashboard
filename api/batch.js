// api/batch.js — 모든 FRED 데이터를 한번에 반환
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=21600'); // Vercel CDN 6시간 캐시
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 없음' });

  const SERIES = [
    ['SOFR',365],['EFFR',365],['IORB',365],['VIXCLS',365],
    ['WRESBAL',730],['RRPONTSYD',730],['WTREGEN',730],['WALCL',730],
    ['T10Y2Y',730],['BAMLH0A0HYM2',730],['STLFSI4',730],['WRMFNS',730],['WRMFSL',730]
  ];

  async function fetchFred(series, days) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().slice(0, 10);
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${API_KEY}&file_type=json&observation_start=${startStr}&sort_order=asc`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${series}: ${r.status}`);
    const data = await r.json();
    if (data.error_code) throw new Error(data.error_message);
    const obs = (data.observations || []).filter(o => o.value !== '.' && o.value !== '');
    let vals = obs.map(o => parseFloat(o.value));
    if (['WRMFNS','WRMFSL'].includes(series) && vals.length > 0 && vals[vals.length-1] < 100) {
      vals = vals.map(v => Math.round(v * 1000 * 10) / 10);
    }
    return { dates: obs.map(o => o.date), vals };
  }

  async function fetchFng() {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'Referer': 'https://edition.cnn.com/', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) throw new Error('FNG: ' + r.status);
    const data = await r.json();
    const hist = data.fear_and_greed_historical?.data || [];
    return {
      current: { score: Math.round(data.fear_and_greed.score), rating: data.fear_and_greed.rating, timestamp: data.fear_and_greed.timestamp },
      dates: hist.map(d => new Date(d.x).toISOString().slice(0, 10)),
      vals: hist.map(d => Math.round(d.y))
    };
  }

  // 병렬 fetch
  const results = { updatedAt: new Date().toISOString(), fred: {}, fng: {} };

  const fredPromises = SERIES.map(async ([s, d]) => {
    try {
      results.fred[`${s}_${d}`] = await fetchFred(s, d);
    } catch(e) {
      results.fred[`${s}_${d}`] = { dates: [], vals: [] };
    }
  });

  const fngPromise = fetchFng().then(d => { results.fng = d; }).catch(() => {});

  await Promise.all([...fredPromises, fngPromise]);

  return res.status(200).json(results);
};
