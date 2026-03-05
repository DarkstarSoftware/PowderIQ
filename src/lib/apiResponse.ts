import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function err(message: string, status: number, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export function handleError(e: unknown, statusOverride?: number) {
  if (e instanceof Error) {
    if (e.message === 'UNAUTHORIZED')        return err('Unauthorized', statusOverride ?? 401);
    if (e.message === 'RESORT_UNAUTHORIZED') return err('Unauthorized', statusOverride ?? 401);
    if (e.message === 'PRO_REQUIRED')        return err('Pro subscription required', statusOverride ?? 403);
    if (e.message === 'FORBIDDEN')           return err('Forbidden', statusOverride ?? 403);
    if (e.message === 'NOT_FOUND')           return err('Not found', statusOverride ?? 404);
    if (statusOverride)                      return err(e.message, statusOverride);
  }
  console.error(e);
  return err('Internal server error', statusOverride ?? 500);
}