import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('products').select('*').order('no', { ascending: true });
      if (error) throw error;
      res.status(200).json({ products: data });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (body.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (body.action === 'verify') {
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const item = body.item || {};
      const row = {
        no: Number(item.no),
        title: String(item.title || '').trim(),
        image: String(item.image || ''),
        link: String(item.link || ''),
      };
      if (!row.no || !row.title || !row.link) {
        res.status(400).json({ error: 'Missing fields' });
        return;
      }
      const { error } = await supabase.from('products').upsert(row, { onConflict: 'no' });
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const no = Number(body.no);
      if (!no) {
        res.status(400).json({ error: 'Missing no' });
        return;
      }
      const { error } = await supabase.from('products').delete().eq('no', no);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Server error' });
  }
}
