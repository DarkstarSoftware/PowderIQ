// src/app/terms/page.tsx
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | PowderIQ',
  description: 'PowderIQ Terms of Service — your rights and responsibilities when using our platform.',
};

export default function TermsPage() {
  const lastUpdated = 'March 18, 2026';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --blue: #1d6ef5; --blue-lt: #e8f1fe;
          --text: #0d1b2e; --text2: #3d5166; --text3: #6b849a;
          --bd: rgba(100,150,200,0.15); --bd2: rgba(100,150,200,0.25);
          --bg: #f0f5fb; --white: #ffffff;
          --sh: 0 2px 12px rgba(15,40,80,0.08);
        }
        html, body { background: #f0f5fb; font-family: 'Inter', sans-serif; color: var(--text); }

        /* TOPNAV */
        .tnav { height: 56px; background: var(--white); border-bottom: 1px solid var(--bd2); display: flex; align-items: center; padding: 0 24px; gap: 12px; box-shadow: var(--sh); position: sticky; top: 0; z-index: 100; }
        .tnav-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .tnav-logo img { height: 32px; width: auto; }
        .tnav-brand { font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; }
        .tnav-back { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--text3); text-decoration: none; display: flex; align-items: center; gap: 4px; }
        .tnav-back:hover { color: var(--text); }

        /* PAGE */
        .page { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }

        /* HEADER */
        .doc-header { margin-bottom: 36px; }
        .doc-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--blue-lt); border-radius: 20px; font-size: 12px; font-weight: 700; color: var(--blue); margin-bottom: 14px; }
        .doc-title { font-size: 32px; font-weight: 900; color: var(--text); margin-bottom: 8px; letter-spacing: -0.02em; }
        .doc-meta { font-size: 13px; color: var(--text3); display: flex; gap: 16px; flex-wrap: wrap; }

        /* TOC */
        .toc { background: var(--white); border: 1px solid var(--bd2); border-radius: 12px; padding: 20px 24px; margin-bottom: 32px; box-shadow: var(--sh); }
        .toc-title { font-size: 13px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
        .toc-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .toc-list a { font-size: 13.5px; font-weight: 500; color: var(--blue); text-decoration: none; }
        .toc-list a:hover { text-decoration: underline; }

        /* SECTIONS */
        .section { background: var(--white); border: 1px solid var(--bd2); border-radius: 14px; padding: 28px 32px; margin-bottom: 16px; box-shadow: var(--sh); }
        .section-num { font-size: 11px; font-weight: 700; color: var(--blue); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
        .section-title { font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 16px; }
        .section p { font-size: 14px; line-height: 1.75; color: var(--text2); margin-bottom: 12px; }
        .section p:last-child { margin-bottom: 0; }
        .section ul, .section ol { padding-left: 20px; margin-bottom: 12px; }
        .section li { font-size: 14px; line-height: 1.75; color: var(--text2); margin-bottom: 6px; }
        .highlight-box { background: var(--blue-lt); border-left: 3px solid var(--blue); border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 16px 0; font-size: 13.5px; color: var(--text2); line-height: 1.6; }
        .warn-box { background: #fef9ec; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 16px 0; font-size: 13.5px; color: #92400e; line-height: 1.6; }

        /* FOOTER */
        .doc-footer { margin-top: 32px; padding: 20px 24px; background: var(--white); border: 1px solid var(--bd2); border-radius: 12px; font-size: 13px; color: var(--text3); text-align: center; line-height: 1.6; }
        .doc-footer a { color: var(--blue); text-decoration: none; font-weight: 600; }
        .doc-footer a:hover { text-decoration: underline; }

        @media(max-width: 600px) { .page { padding: 24px 16px 60px; } .section { padding: 20px; } .doc-title { font-size: 24px; } }
      `}</style>

      {/* Topnav */}
      <nav className="tnav">
        <Link href="/" className="tnav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" />
          <span className="tnav-brand">PowderIQ</span>
        </Link>
        <Link href="/auth/signup" className="tnav-back">← Back to Sign Up</Link>
      </nav>

      <div className="page">

        {/* Header */}
        <div className="doc-header">
          <div className="doc-badge">📄 Legal</div>
          <h1 className="doc-title">Terms of Service</h1>
          <div className="doc-meta">
            <span>Last updated: {lastUpdated}</span>
            <span>Effective: {lastUpdated}</span>
          </div>
        </div>

        {/* TOC */}
        <div className="toc">
          <div className="toc-title">Table of Contents</div>
          <ol className="toc-list">
            {[
              ['#acceptance',    '1. Acceptance of Terms'],
              ['#description',   '2. Description of Service'],
              ['#accounts',      '3. User Accounts'],
              ['#subscriptions', '4. Subscriptions & Billing'],
              ['#acceptable',    '5. Acceptable Use'],
              ['#ip',            '6. Intellectual Property'],
              ['#data',          '7. Data & Privacy'],
              ['#disclaimers',   '8. Disclaimers'],
              ['#limitation',    '9. Limitation of Liability'],
              ['#termination',   '10. Termination'],
              ['#changes',       '11. Changes to Terms'],
              ['#contact',       '12. Contact Information'],
            ].map(([href, label]) => (
              <li key={href}><a href={href as string}>{label as string}</a></li>
            ))}
          </ol>
        </div>

        <div className="highlight-box">
          Please read these Terms of Service carefully before using PowderIQ. By creating an account or using our service, you agree to be bound by these terms.
        </div>

        {/* Section 1 */}
        <div className="section" id="acceptance">
          <div className="section-num">Section 1</div>
          <h2 className="section-title">Acceptance of Terms</h2>
          <p>These Terms of Service (&quot;Terms&quot;) govern your access to and use of PowderIQ, operated by DarkStar Software LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using PowderIQ at powderiq.com or through any related applications, you agree to be bound by these Terms.</p>
          <p>If you do not agree to these Terms, you may not access or use our service. These Terms apply to all visitors, users, and others who access or use the Service.</p>
        </div>

        {/* Section 2 */}
        <div className="section" id="description">
          <div className="section-num">Section 2</div>
          <h2 className="section-title">Description of Service</h2>
          <p>PowderIQ is a snow forecasting and mountain intelligence platform designed for skiers and snowboarders. Our service provides:</p>
          <ul>
            <li>AI-powered powder scores and snow condition forecasting for ski resorts</li>
            <li>Real-time and historical snowfall data aggregated from multiple weather sources</li>
            <li>Personalized resort recommendations based on riding style and skill level</li>
            <li>Powder alerts and notifications for saved resorts</li>
            <li>Resort comparison tools and analytics</li>
            <li>Resort operator dashboards and management tools (for resort accounts)</li>
          </ul>
          <p>We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice where possible.</p>
        </div>

        {/* Section 3 */}
        <div className="section" id="accounts">
          <div className="section-num">Section 3</div>
          <h2 className="section-title">User Accounts</h2>
          <p>To access certain features of PowderIQ, you must create an account. When creating your account, you agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain the security of your password and account credentials</li>
            <li>Promptly update any information that becomes inaccurate</li>
            <li>Accept responsibility for all activity that occurs under your account</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
          <p>You must be at least 13 years of age to create an account. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms on your behalf.</p>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms, contain false information, or engage in conduct we deem harmful to other users or the platform.</p>
        </div>

        {/* Section 4 */}
        <div className="section" id="subscriptions">
          <div className="section-num">Section 4</div>
          <h2 className="section-title">Subscriptions &amp; Billing</h2>
          <p>PowderIQ offers both free and paid subscription tiers. Paid subscriptions are billed through Stripe and governed by the following terms:</p>
          <ul>
            <li><strong>Billing Cycle:</strong> Subscriptions are billed monthly or annually depending on your selected plan.</li>
            <li><strong>Free Trial:</strong> Certain plans include a 14-day free trial. You will not be charged until the trial period ends. You may cancel at any time during the trial without charge.</li>
            <li><strong>Automatic Renewal:</strong> Subscriptions automatically renew at the end of each billing period unless cancelled before the renewal date.</li>
            <li><strong>Cancellation:</strong> You may cancel your subscription at any time through your account billing settings. Cancellation takes effect at the end of the current billing period — you will retain access until then.</li>
            <li><strong>Refunds:</strong> We do not offer refunds for partial billing periods. If you believe a charge was made in error, contact us within 30 days.</li>
            <li><strong>Price Changes:</strong> We may change subscription prices with at least 30 days notice. Continued use after the notice period constitutes acceptance of the new pricing.</li>
          </ul>
          <div className="warn-box">
            Subscription fees are non-refundable except as required by applicable law or as expressly stated in these Terms.
          </div>
        </div>

        {/* Section 5 */}
        <div className="section" id="acceptable">
          <div className="section-num">Section 5</div>
          <h2 className="section-title">Acceptable Use</h2>
          <p>You agree not to use PowderIQ to:</p>
          <ul>
            <li>Violate any applicable laws, regulations, or third-party rights</li>
            <li>Scrape, crawl, or systematically extract data from the platform without written permission</li>
            <li>Attempt to gain unauthorized access to any part of the service or its infrastructure</li>
            <li>Transmit malware, viruses, or other harmful code</li>
            <li>Impersonate any person or entity, or misrepresent your affiliation</li>
            <li>Use the service to send unsolicited communications (spam)</li>
            <li>Interfere with or disrupt the integrity or performance of the service</li>
            <li>Reverse engineer, decompile, or attempt to derive the source code of the platform</li>
            <li>Resell or sublicense access to the service without our written consent</li>
          </ul>
          <p>Violation of these restrictions may result in immediate termination of your account and potential legal action.</p>
        </div>

        {/* Section 6 */}
        <div className="section" id="ip">
          <div className="section-num">Section 6</div>
          <h2 className="section-title">Intellectual Property</h2>
          <p>The PowderIQ platform, including its design, software, algorithms, data models, logos, and content created by us, is owned by DarkStar Software LLC and protected by copyright, trademark, and other intellectual property laws.</p>
          <p>We grant you a limited, non-exclusive, non-transferable license to access and use the Service for personal, non-commercial purposes (or commercial purposes within the scope of your subscription plan).</p>
          <p>You retain ownership of any content you submit to PowderIQ (such as profile information). By submitting content, you grant us a worldwide, royalty-free license to use, store, and display that content solely to provide and improve the Service.</p>
          <p>Weather data, snow reports, and forecasting information displayed on PowderIQ may be sourced from third parties including NOAA, Open-Meteo, and other weather data providers, and is subject to their respective terms.</p>
        </div>

        {/* Section 7 */}
        <div className="section" id="data">
          <div className="section-num">Section 7</div>
          <h2 className="section-title">Data &amp; Privacy</h2>
          <p>Your use of PowderIQ is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using our service, you consent to our collection and use of data as described in the Privacy Policy.</p>
          <p>We take data security seriously and implement industry-standard measures to protect your information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
          <p>You may request a copy of your data or deletion of your account at any time through the Data &amp; Privacy section of your account settings.</p>
        </div>

        {/* Section 8 */}
        <div className="section" id="disclaimers">
          <div className="section-num">Section 8</div>
          <h2 className="section-title">Disclaimers</h2>
          <div className="warn-box">
            <strong>Weather and snow forecasting is inherently uncertain.</strong> PowderIQ provides powder scores and forecasts for informational purposes only. We make no guarantees about the accuracy, completeness, or timeliness of any forecasting data.
          </div>
          <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
          <p>We do not warrant that the service will be uninterrupted, error-free, or free of viruses or other harmful components. You use the service at your own risk.</p>
          <p>PowderIQ is not responsible for decisions you make based on powder scores or forecasting data, including but not limited to travel bookings, equipment purchases, or skiing/snowboarding activities.</p>
        </div>

        {/* Section 9 */}
        <div className="section" id="limitation">
          <div className="section-num">Section 9</div>
          <h2 className="section-title">Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DARKSTAR SOFTWARE LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.</p>
          <p>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100 USD.</p>
          <p>Some jurisdictions do not allow the exclusion or limitation of certain damages, so the above limitations may not apply to you.</p>
        </div>

        {/* Section 10 */}
        <div className="section" id="termination">
          <div className="section-num">Section 10</div>
          <h2 className="section-title">Termination</h2>
          <p>Either party may terminate these Terms at any time. You may terminate by deleting your account through account settings. We may terminate or suspend your access immediately, without prior notice or liability, for any reason including a breach of these Terms.</p>
          <p>Upon termination:</p>
          <ul>
            <li>Your right to access the Service ceases immediately</li>
            <li>Any pending subscription charges may still be processed</li>
            <li>Provisions of these Terms that by their nature should survive termination will survive, including intellectual property provisions, disclaimers, and limitations of liability</li>
          </ul>
        </div>

        {/* Section 11 */}
        <div className="section" id="changes">
          <div className="section-num">Section 11</div>
          <h2 className="section-title">Changes to Terms</h2>
          <p>We reserve the right to modify these Terms at any time. We will provide notice of material changes by:</p>
          <ul>
            <li>Updating the &quot;Last Updated&quot; date at the top of this page</li>
            <li>Sending an email notification to your registered address</li>
            <li>Displaying a notice within the PowderIQ application</li>
          </ul>
          <p>Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Service.</p>
        </div>

        {/* Section 12 */}
        <div className="section" id="contact">
          <div className="section-num">Section 12</div>
          <h2 className="section-title">Contact Information</h2>
          <p>If you have questions about these Terms of Service, please contact us:</p>
          <ul>
            <li><strong>Email:</strong> legal@powderiq.com</li>
            <li><strong>Company:</strong> DarkStar Software LLC</li>
            <li><strong>Website:</strong> powderiq.com</li>
          </ul>
          <p>We aim to respond to all legal inquiries within 5 business days.</p>
        </div>

        {/* Footer */}
        <div className="doc-footer">
          These Terms of Service were last updated on {lastUpdated}.<br/>
          By using PowderIQ, you acknowledge that you have read and understood these terms.<br/><br/>
          <Link href="/auth/signup">← Back to Sign Up</Link> &nbsp;·&nbsp; <Link href="/auth/login">Sign In</Link>
        </div>

      </div>
    </>
  );
}
