module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 필요' });

  const API_KEY = process.env.FRED_API_KEY || '38a4c9938e82be4200fd122b8fe645a1';

  const start = new Date();
  start.setDate(start.getDate() - (parseInt(days) || 365));
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${API_KEY}&file_type=json&observation_start=${start.toISOString().slice(0,10)}&sort_order=asc`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}`);
    const data = await r.json();
    if (data.error_code) throw new Error(data.error_message);
    const obs = (data.observations||[]).filter(o=>o.value!=='.'&&o.value!=='');
    let vals = obs.map(o=>parseFloat(o.value));
    if(['WRMFNS','WRMFSL'].includes(series.toUpperCase())&&vals.length>0&&vals[vals.length-1]<100)
      vals=vals.map(v=>+(v*1000).toFixed(1));
    return res.status(200).json({ dates: obs.map(o=>o.date), vals });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
