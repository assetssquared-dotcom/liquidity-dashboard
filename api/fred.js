// api/fred.js — Vercel 서버리스 함수 (CommonJS)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 파라미터 필요' });

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 환경변수가 설정되지 않았습니다' });

  const start = new Date();
  start.setDate(start.getDate() - (parseInt(days) || 365));
  const startStr = start.toISOString().slice(0, 10);

  const url = `https://api.stlouisfed.org/fred/series/observations`
            + `?series_id=${series}&api_key=${API_KEY}&file_type=json`
            + `&observation_start=${startStr}&sort_order=asc`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FRED 응답 오류: ${r.status}`);
    const data = await r.json();
    if (data.error_code) throw new Error(data.error_message || 'FRED API 오류');

    const obs = (data.observations || []).filter(o => o.value !== '.' && o.value !== '');
    return res.status(200).json({
      dates: obs.map(o => o.date),
      vals:  obs.map(o => parseFloat(o.value)),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
