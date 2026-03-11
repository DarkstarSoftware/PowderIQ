// src/components/auth/AuthShell.tsx
// Shared wrapper for all auth pages: mountain background + centered card
import Link from 'next/link';
import Image from 'next/image';

interface AuthShellProps {
  children: React.ReactNode;
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .auth-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }
        .auth-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
        }
        .auth-bg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 30%;
        }
        .auth-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(210,228,248,0.52) 0%,
            rgba(185,212,242,0.42) 40%,
            rgba(200,220,245,0.48) 100%
          );
        }
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(255,255,255,0.84);
          backdrop-filter: blur(28px) saturate(1.8);
          -webkit-backdrop-filter: blur(28px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.92);
          border-radius: 24px;
          padding: 36px 36px 32px;
          box-shadow:
            0 8px 48px rgba(70,110,180,0.16),
            0 2px 8px rgba(70,110,180,0.10),
            inset 0 1px 0 rgba(255,255,255,0.98);
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity:0; transform:translateY(20px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .auth-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
          animation: logoIn 0.55s cubic-bezier(0.22,1,0.36,1) 0.08s both;
        }
        .auth-logo-wrap a {
          display: block;
          line-height: 0;
        }
        .auth-logo-wrap img {
          width: 110px;
          height: auto;
          filter: drop-shadow(0 6px 20px rgba(20,60,150,0.28));
        }
        @keyframes logoIn {
          from { opacity:0; transform:translateY(-14px) scale(0.88); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>

      <div className="auth-root">
        <div className="auth-bg" aria-hidden="true">
          <img
            src="/brand/auth-bg.jpg"
            alt=""
            aria-hidden="true"
          />
        </div>

        <div className="auth-card" role="main">
          <div className="auth-logo-wrap">
            <Link href="/" aria-label="PowderIQ home">
              <img
                src="/brand/powderiq_logo.png"
                alt="PowderIQ"
                width={110}
                height={92}
              />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
