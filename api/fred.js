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

    // MMF 시리즈는 단위가 $B이지만 실제로는 수천 단위로 나옴
    // 값이 소수점 이하(0~2 사이)면 $T 단위 → $B 변환 (×1000)
    // 값이 1000 이상이면 이미 $B
    // 값이 1~100 사이면 $T 단위 → $B 변환
    if (vals.length > 0) {
      const sample = vals[vals.length - 1];
      if (sample > 0 && sample < 50) {
        // $T 단위 → $B로 변환
        vals = vals.map(v => +(v * 1000).toFixed(2));
      }
    }

    return res.status(200).json({
      dates: obs.map(o => o.date),
      vals,
      // 디버그용: 원본 마지막 값
      _raw_last: obs.length > 0 ? obs[obs.length-1].value : null,
      _series: series,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
