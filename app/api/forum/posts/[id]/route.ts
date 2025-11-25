import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const PUT = requireAuth(async (request: NextRequest, user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { title, content } = body;
    if (!title || !content) {
      return NextResponse.json({ error: 'Missing title or content' }, { status: 400 });
    }

    // Verify ownership or admin
    const ownerRes = await pool.query('SELECT user_id FROM forum_posts WHERE id = $1', [id]);
    if (ownerRes.rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    const ownerId = ownerRes.rows[0].user_id;
    if (ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await pool.query(
      'UPDATE forum_posts SET title = $1, content = $2, updated_at = $3 WHERE id = $4 RETURNING id, title, content, created_at, updated_at',
      [title, content, new Date(), id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
});

export const DELETE = requireAuth(async (request: NextRequest, user, context) => {
  try {
    const { id } = await context.params;
    const ownerRes = await pool.query('SELECT user_id FROM forum_posts WHERE id = $1', [id]);
    if (ownerRes.rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    const ownerId = ownerRes.rows[0].user_id;
    if (ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await pool.query('DELETE FROM comments WHERE post_id = $1', [id]);
    await pool.query('DELETE FROM forum_posts WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
});
