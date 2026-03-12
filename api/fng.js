module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'Referer': 'https://edition.cnn.com/', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) throw new Error(`CNN: ${r.status}`);
    const data = await r.json();
    const hist = data.fear_and_greed_historical?.data || [];
    return res.status(200).json({
      current: { score: Math.round(data.fear_and_greed.score), rating: data.fear_and_greed.rating, timestamp: data.fear_and_greed.timestamp },
      previous: { oneWeekAgo: data.fear_and_greed.previous_1_week, oneMonthAgo: data.fear_and_greed.previous_1_month, oneYearAgo: data.fear_and_greed.previous_1_year },
      dates: hist.map(d => new Date(d.x).toISOString().slice(0,10)),
      vals: hist.map(d => Math.round(d.y))
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
