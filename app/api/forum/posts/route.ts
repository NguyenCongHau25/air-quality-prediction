import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.created_at, p.user_id,
        json_build_object('id', u.id, 'name', u.name) as author,
        COALESCE(json_agg(json_build_object('id', c.id, 'content', c.content, 'created_at', c.created_at, 'user_id', c.user_id, 'author', json_build_object('id', cu.id, 'name', cu.name))) FILTER (WHERE c.id IS NOT NULL), '[]') as comments
      FROM forum_posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN comments c ON c.post_id = p.id
      LEFT JOIN users cu ON cu.id = c.user_id
      GROUP BY p.id, u.id, u.name
      ORDER BY p.created_at DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { title, content } = body;
    if (!title || !content) {
      return NextResponse.json({ error: 'Missing title or content' }, { status: 400 });
    }

    const now = new Date();
    const result = await pool.query(
      'INSERT INTO forum_posts (user_id, title, content, created_at) VALUES ($1, $2, $3, $4) RETURNING id, title, content, created_at',
      [user.id, title, content, now]
    );

    const post = result.rows[0];
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
});
