// api/schedule.js
// スケジュール投稿の保存・取得・削除
// Vercel KV（無料枠：30,000リクエスト/月）を使用

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      // スケジュール投稿を保存
      const { posts, accessToken, igAccountId } = req.body;
      if (!posts || !Array.isArray(posts)) {
        return res.status(400).json({ error: 'posts array required' });
      }

      const scheduleData = {
        posts: posts.map(p => ({
          ...p,
          id: `post_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
          status: 'scheduled'
        })),
        accessToken,
        igAccountId,
        savedAt: new Date().toISOString()
      };

      // KVに保存（キー: schedule:easen）
      await kv.set('schedule:easen', JSON.stringify(scheduleData));

      return res.status(200).json({ success: true, count: scheduleData.posts.length });

    } else if (req.method === 'GET') {
      // スケジュール一覧を取得
      const raw = await kv.get('schedule:easen');
      if (!raw) return res.status(200).json({ posts: [] });
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json(data);

    } else if (req.method === 'DELETE') {
      // スケジュールをクリア
      await kv.del('schedule:easen');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('schedule error:', err);
    // KVが未設定の場合はlocalStorageフォールバックの旨を返す
    return res.status(500).json({ error: err.message, fallback: true });
  }
}
