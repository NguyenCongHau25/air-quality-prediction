import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const POST = requireAuth(async (request: NextRequest, user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { content } = body;
    if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 });

    const now = new Date();
    const result = await pool.query(
      'INSERT INTO comments (post_id, user_id, content, created_at) VALUES ($1, $2, $3, $4) RETURNING id, content, created_at',
      [id, user.id, content, now]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
});
