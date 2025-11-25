import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const PUT = requireAuth(async (request: NextRequest, user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { content } = body;
    if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 });

    const ownerRes = await pool.query('SELECT user_id FROM comments WHERE id = $1', [id]);
    if (ownerRes.rows.length === 0) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    const ownerId = ownerRes.rows[0].user_id;
    if (ownerId !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await pool.query('UPDATE comments SET content = $1, updated_at = $2 WHERE id = $3 RETURNING id, content, created_at, updated_at', [content, new Date(), id]);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
});

export const DELETE = requireAuth(async (request: NextRequest, user, context) => {
  try {
    const { id } = await context.params;
    const ownerRes = await pool.query('SELECT user_id FROM comments WHERE id = $1', [id]);
    if (ownerRes.rows.length === 0) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    const ownerId = ownerRes.rows[0].user_id;
    if (ownerId !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
});
