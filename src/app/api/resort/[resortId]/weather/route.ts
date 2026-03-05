import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { verifyResortAccess } from '@/lib/auth';
import { getResortElevationWeather } from '@/services/elevationWeatherService';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'));

    const report = await getResortElevationWeather(resortId);

    return ok(report);
  } catch (e) {
    return handleError(e);
  }
}