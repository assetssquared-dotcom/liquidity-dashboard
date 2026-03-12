// api/fred.js — Vercel 서버리스 함수
// 브라우저 대신 서버에서 FRED API를 호출해 CORS 문제를 원천 해결합니다.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 파라미터 필요' });

  const start = new Date();
  start.setDate(start.getDate() - (parseInt(days) || 365));
  const startStr = start.toISOString().slice(0, 10);

  const API_KEY = process.env.FRED_API_KEY;
  const url = `https://api.stlouisfed.org/fred/series/observations`
            + `?series_id=${series}&api_key=${API_KEY}&file_type=json`
            + `&observation_start=${startStr}&sort_order=asc`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FRED 오류: ${r.status}`);
    const data = await r.json();
    if (data.error_code) throw new Error(data.error_message);

    const obs = (data.observations || []).filter(o => o.value !== '.' && o.value !== '');
    return res.status(200).json({
      dates: obs.map(o => o.date),
      vals:  obs.map(o => parseFloat(o.value)),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
