// api/cron.js
// Vercel Cronで毎日9時（JST）に実行
// スケジュール済み投稿の中から今日の投稿を自動実行する

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Vercel Cronからのリクエストのみ許可
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const raw = await kv.get('schedule:easen');
    if (!raw) return res.status(200).json({ message: 'No scheduled posts' });

    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { posts, accessToken, igAccountId } = data;

    if (!posts || !accessToken || !igAccountId) {
      return res.status(200).json({ message: 'Incomplete schedule data' });
    }

    // 今日の日付（JST）
    const now = new Date();
    const jstOffset = 9 * 60;
    const jst = new Date(now.getTime() + jstOffset * 60 * 1000);
    const todayStr = jst.toISOString().slice(0, 10).replace(/-/g, '/');

    const todayPosts = posts.filter(p => p.date === todayStr && p.status === 'scheduled');

    if (todayPosts.length === 0) {
      return res.status(200).json({ message: `No posts for today (${todayStr})` });
    }

    const results = [];

    for (const post of todayPosts) {
      try {
        // 画像URLが既にhttpsであることを確認（imgBBからのURL）
        if (!post.imageUrl || !post.imageUrl.startsWith('https://')) {
          results.push({ id: post.id, status: 'failed', reason: 'No valid imageUrl' });
          continue;
        }

        const caption = post.caption + '\n\n' + post.hashtags;

        // Instagram投稿
        const createRes = await fetch(
          `https://graph.facebook.com/v23.0/${igAccountId}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: post.imageUrl, caption, access_token: accessToken })
          }
        );
        const createData = await createRes.json();

        if (!createData.id) {
          results.push({ id: post.id, status: 'failed', reason: JSON.stringify(createData) });
          continue;
        }

        const pubRes = await fetch(
          `https://graph.facebook.com/v23.0/${igAccountId}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: createData.id, access_token: accessToken })
          }
        );
        const pubData = await pubRes.json();

        if (pubData.id) {
          post.status = 'posted';
          post.postedAt = new Date().toISOString();
          results.push({ id: post.id, status: 'posted', igPostId: pubData.id });
        } else {
          results.push({ id: post.id, status: 'failed', reason: JSON.stringify(pubData) });
        }

      } catch (e) {
        results.push({ id: post.id, status: 'error', reason: e.message });
      }

      // API制限対策：投稿間隔を1秒空ける
      await new Promise(r => setTimeout(r, 1000));
    }

    // 更新したスケジュールをKVに保存
    await kv.set('schedule:easen', JSON.stringify(data));

    console.log(`Cron result: ${results.length} posts processed`);
    return res.status(200).json({ success: true, results });

  } catch (err) {
    console.error('cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
