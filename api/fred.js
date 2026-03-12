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

    // WRMFNS, WRMFSL: 단위가 조달러($T) → $B 변환
    // 현재 MMF 총액 약 6~7조달러 = 6000~7000B
    // FRED에서 이 시리즈는 십억달러 단위이지만
    // 실제로는 수천 단위로 와야 정상 (6000~7000)
    // 만약 6~7 사이로 오면 $T 단위 → ×1000
    const needsConvert = ['WRMFNS', 'WRMFSL'];
    if (needsConvert.includes(series.toUpperCase()) && vals.length > 0) {
      const last = vals[vals.length - 1];
      if (last < 100) {
        // $T 단위 → $B 변환
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
