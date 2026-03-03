import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { verifyResortAccess } from '@/lib/auth';
import { getResortElevationWeather } from '@/services/elevationWeatherService';

export async function GET(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const report = await getResortElevationWeather(resortId);
    return ok(report);
  } catch (e) {
    return handleError(e);
  }
}
