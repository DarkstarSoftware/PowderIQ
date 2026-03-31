// src/services/revenueCatService.ts
// Server-side RevenueCat REST API integration.
// Used to:
//   1. Set the app_user_id when a user signs up (links RC to Supabase user)
//   2. Grant entitlements after web Stripe purchase
//   3. Check entitlement status on demand (as fallback)

const RC_API_KEY    = process.env.REVENUECAT_SECRET_KEY ?? '';
const RC_BASE       = 'https://api.revenuecat.com/v1';
const PRO_ENTITLEMENT = 'pro';

// ── Set app_user_id alias ─────────────────────────────────────────────────────
// Call this when a user first signs up so RevenueCat knows to associate
// their Supabase user ID with any IAP they make on mobile.
export async function identifyUser(supabaseUserId: string) {
  if (!RC_API_KEY) return;
  try {
    await fetch(`${RC_BASE}/subscribers/${encodeURIComponent(supabaseUserId)}`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${RC_API_KEY}`, 'Content-Type': 'application/json' },
    });
    // GET creates the subscriber if they don't exist
  } catch (e) {
    console.warn('[RevenueCat] identifyUser failed:', e);
  }
}

// ── Grant Pro entitlement via Stripe ─────────────────────────────────────────
// Called after successful Stripe checkout webhook so RevenueCat reflects
// the web purchase on mobile devices.
export async function grantProEntitlement(
  supabaseUserId: string,
  stripeSubscriptionId: string,
  currentPeriodEnd: Date,
) {
  if (!RC_API_KEY) return;
  try {
    await fetch(
      `${RC_BASE}/subscribers/${encodeURIComponent(supabaseUserId)}/entitlements/${PRO_ENTITLEMENT}/promotional`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${RC_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration:   'custom',
          end_time_ms: currentPeriodEnd.getTime(),
        }),
      }
    );
    console.log(`[RevenueCat] Granted pro to ${supabaseUserId} until ${currentPeriodEnd.toISOString()}`);
  } catch (e) {
    console.warn('[RevenueCat] grantProEntitlement failed:', e);
  }
}

// ── Revoke Pro entitlement ────────────────────────────────────────────────────
export async function revokeProEntitlement(supabaseUserId: string) {
  if (!RC_API_KEY) return;
  try {
    await fetch(
      `${RC_BASE}/subscribers/${encodeURIComponent(supabaseUserId)}/entitlements/${PRO_ENTITLEMENT}/revoke_promotionals`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${RC_API_KEY}`, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.warn('[RevenueCat] revokeProEntitlement failed:', e);
  }
}

// ── Check entitlement status ──────────────────────────────────────────────────
// Fallback check — use DB as primary, this as secondary verification.
export async function checkProEntitlement(supabaseUserId: string): Promise<boolean> {
  if (!RC_API_KEY) return false;
  try {
    const res = await fetch(
      `${RC_BASE}/subscribers/${encodeURIComponent(supabaseUserId)}`,
      { headers: { Authorization: `Bearer ${RC_API_KEY}` } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const entitlement = data?.subscriber?.entitlements?.[PRO_ENTITLEMENT];
    if (!entitlement) return false;
    const expires = entitlement.expires_date;
    return !expires || new Date(expires) > new Date();
  } catch {
    return false;
  }
}
