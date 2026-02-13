import { NextResponse } from 'next/server';

export async function POST() {
  return new NextResponse('Photo analysis is temporarily disabled.', { status: 410 });
}
