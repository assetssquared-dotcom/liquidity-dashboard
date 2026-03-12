module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8676682662:AAFMgzGATR3GxmvczgurNaxyNPKdvOMZGGY';
  const CHANNEL_ID = '-1002607172465';
  const limit = Math.min(parseInt(req.query.limit) || 10, 20);

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100&allowed_updates=["channel_post"]`
    );
    const data = await r.json();
    if (!data.ok) throw new Error(data.description || 'Telegram API error');

    const posts = (data.result || [])
      .filter(u => u.channel_post)
      .map(u => u.channel_post)
      .filter(p => String(p.chat.id) === CHANNEL_ID)
      .reverse()
      .slice(0, limit)
      .map(p => ({
        message_id: p.message_id,
        date: p.date,
        text: p.text || p.caption || '',
      }));

    return res.status(200).json({ ok: true, posts });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
