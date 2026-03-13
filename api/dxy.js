module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const days = parseInt(req.query.days) || 365;
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - days * 86400;

  const tickers = ['DX-Y.NYB', 'DXY', '^DXY', 'UUP'];

  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];

      const dateMap = new Map();
      timestamps.forEach((ts, i) => {
        const v = closes[i];
        if (v != null && !isNaN(v)) {
          const date = new Date(ts * 1000).toISOString().slice(0, 10);
          dateMap.set(date, +v.toFixed(3)); // 중복 날짜는 마지막 값으로 덮어씀
        }
      });

      if (!dateMap.size) continue;

      const dates = [...dateMap.keys()];
      let vals = [...dateMap.values()];

      // UUP는 ETF라 DXY 근사값으로 변환
      if (ticker === 'UUP') vals = vals.map(v => +(v * 3.65).toFixed(2));

      return res.status(200).json({ dates, vals, source: ticker });
    } catch(e) {
      continue;
    }
  }

  return res.status(500).json({ error: 'All tickers failed' });
};
