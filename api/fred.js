// api/fred.js — Vercel 서버리스 함수 (CommonJS)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, days } = req.query;
  if (!series) return res.status(400).json({ error: 'series 파라미터 필요' });

  const API_KEY = process.env.FRED_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FRED_API_KEY 환경변수 없음' });

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

    // MMF 시리즈(WRMFNS, WRMFSL)는 FRED에서 조달러($T) 단위로 반환됨
    // 예: 6.5 = $6.5T = $6500B
    // 값이 0~50 사이면 $T 단위로 판단 → $B로 변환(×1000)
    const MMF_SERIES = ['WRMFNS', 'WRMFSL', 'WRMFSL', 'MMMFFAQ027S'];
    const isMmf = MMF_SERIES.includes(series.toUpperCase());
    if (isMmf && vals.length > 0 && vals[vals.length - 1] < 50) {
      vals = vals.map(v => Math.round(v * 1000 * 100) / 100);
    }

    return res.status(200).json({
      dates: obs.map(o => o.date),
      vals,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
