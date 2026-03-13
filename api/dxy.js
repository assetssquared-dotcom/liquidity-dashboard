module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const days = parseInt(req.query.days) || 365;
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - days * 86400;

  // 순서대로 시도하는 폴백 티커 목록
  const tickers = ['DX-Y.NYB', 'DXY', '^DXY', 'UUP'];

  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];

      const dates = [], vals = [];
      timestamps.forEach((ts, i) => {
        const v = closes[i];
        if (v != null && !isNaN(v)) {
          dates.push(new Date(ts * 1000).toISOString().slice(0, 10));
          vals.push(+v.toFixed(3));
        }
      });

      if (!dates.length) continue;

      // UUP는 ETF라 스케일이 달라서 DXY로 변환 (UUP * 3.65 근사)
      const scaledVals = ticker === 'UUP' ? vals.map(v => +(v * 3.65).toFixed(2)) : vals;

      return res.status(200).json({ dates, vals: scaledVals, source: ticker });
    } catch(e) {
      continue;
    }
  }

  return res.status(500).json({ error: 'All tickers failed' });
};
