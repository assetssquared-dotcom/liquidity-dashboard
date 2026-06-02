module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8676682662:AAFMgzGATR3GxmvczgurNaxyNPKdvOMZGGY';
  const CHANNEL_ID = '-1002607172465';
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  try {
    // 방법1: 채널 메시지 직접 가져오기 (봇이 채널 관리자인 경우)
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100&allowed_updates=["channel_post","message"]`
    );
    const data = await r.json();
    if (!data.ok) throw new Error(data.description || 'Telegram error');

    // 채널 포스트 + 포워드 메시지 모두 수집
    const posts = (data.result || [])
      .filter(u => {
        // 채널 포스트 (채널에 직접 올린 글)
        if (u.channel_post && u.channel_post.chat.id == CHANNEL_ID) return true;
        // 봇 DM으로 포워드된 메시지
        if (u.message && (u.message.forward_origin || u.message.forward_from_chat || u.message.text)) return true;
        return false;
      })
      .map(u => u.channel_post || u.message)
      .reverse()
      .slice(0, limit)
      .map(m => ({
        message_id: m.message_id,
        date: m.date,
        text: m.text || m.caption || '',
        forward_date: m.forward_date || m.forward_origin?.date || null,
        is_forward: !!(m.forward_origin || m.forward_from_chat || m.forward_date),
      }))
      .filter(p => p.text.length > 0);

    return res.status(200).json({ ok: true, posts });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
