module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 파라미터 필요' });

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 없음' });

  const start = new Date();
  start.setDate(start.getDate() - (parseInt(days) || 365));
  const startStr = start.toISOString().slice(0, 10);

  // MMF 시리즈 코드 매핑 (FRED 검증된 코드로 교체)
  const SERIES_MAP = {
    'WRMFNS': 'WRMFNS',   // Retail MMF — 없으면 아래로 대체
    'WRMFSL': 'WRMFSL',   // Institutional MMF
  };

  const actualSeries = SERIES_MAP[series.toUpperCase()] || series;

  const url = `https://api.stlouisfed.org/fred/series/observations`
            + `?series_id=${actualSeries}&api_key=${API_KEY}&file_type=json`
            + `&observation_start=${startStr}&sort_order=asc`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FRED 오류: ${r.status}`);
    const data = await r.json();
    if (data.error_code) throw new Error(data.error_message || 'FRED API 오류');

    const allObs = data.observations || [];
    const obs = allObs.filter(o => o.value !== '.' && o.value !== '');
    let vals = obs.map(o => parseFloat(o.value));

    // MMF 단위 변환: $T → $B (값이 100 미만이면)
    const mmfSeries = ['WRMFNS', 'WRMFSL'];
    if (mmfSeries.includes(series.toUpperCase()) && vals.length > 0) {
      if (vals[vals.length - 1] < 100) {
        vals = vals.map(v => Math.round(v * 1000 * 10) / 10);
      }
    }

    return res.status(200).json({
      dates: obs.map(o => o.date),
      vals,
      _debug: {
        series: actualSeries,
        total_obs: allObs.length,
        valid_obs: obs.length,
        sample: allObs.slice(0, 3).map(o => o.value),
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
