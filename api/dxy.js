module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const days = parseInt(req.query.days) || 14;
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - days * 86400;

  try {
    // Yahoo Finance DXY (DX-Y.NYB)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&period1=${period1}&period2=${period2}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('no data');

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

    if (!dates.length) throw new Error('no data');
    return res.status(200).json({ dates, vals });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
