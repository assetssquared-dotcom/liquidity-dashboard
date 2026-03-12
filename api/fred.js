module.exports = async function handler(req, res) {
  // 캐시 완전 비활성화
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 파라미터 필요' });

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 없음' });

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
    if (data.error_code) throw new Error(data.error_message || 'FRED API 오류');

    const obs = (data.observations || []).filter(o => o.value !== '.' && o.value !== '');
    let vals = obs.map(o => parseFloat(o.value));

    // MMF 단위 변환: $T → $B
    const mmfSeries = ['WRMFNS', 'WRMFSL'];
    if (mmfSeries.includes(series.toUpperCase()) && vals.length > 0) {
      if (vals[vals.length - 1] < 100) {
        vals = vals.map(v => Math.round(v * 1000 * 10) / 10);
      }
    }

    return res.status(200).json({
      dates: obs.map(o => o.date),
      vals,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
