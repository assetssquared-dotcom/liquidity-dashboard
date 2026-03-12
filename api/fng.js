// api/fng.js — CNN Fear & Greed Index 서버사이드 스크래핑
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // CNN 공식 Fear & Greed API 엔드포인트
    const r = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://edition.cnn.com/',
          'Origin': 'https://edition.cnn.com',
        }
      }
    );

    if (!r.ok) throw new Error(`CNN API 오류: ${r.status}`);
    const data = await r.json();

    const current = data.fear_and_greed;
    const historical = data.fear_and_greed_historical?.data || [];

    // 히스토리: [{x: timestamp_ms, y: score}, ...]
    const dates = historical.map(d => new Date(d.x).toISOString().slice(0,10));
    const vals  = historical.map(d => Math.round(d.y));

    return res.status(200).json({
      current: {
        score:     Math.round(current.score),
        rating:    current.rating,         // "Fear" / "Greed" 등
        timestamp: current.timestamp,
      },
      previous: {
        oneWeekAgo:   Math.round(data.fear_and_greed_historical?.data?.slice(-7)?.[0]?.y ?? 0),
        oneMonthAgo:  Math.round(data.fear_and_greed_historical?.data?.slice(-30)?.[0]?.y ?? 0),
        oneYearAgo:   Math.round(data.fear_and_greed_historical?.data?.slice(-365)?.[0]?.y ?? 0),
      },
      dates,
      vals,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
