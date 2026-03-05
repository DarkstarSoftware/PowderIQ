import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function err(message: string, status: number, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof Error) {
    if (e.message === 'UNAUTHORIZED') return err('Unauthorized', 401);
    if (e.message === 'PRO_REQUIRED') return err('Pro subscription required', 403);
    if (e.message === 'FORBIDDEN') return err('Forbidden', 403);
    if (e.message === 'NOT_FOUND') return err('Not found', 404);
  }
  console.error(e);
  return err('Internal server error', 500);
}