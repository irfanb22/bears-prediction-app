import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/siteContact';

export function SiteFooter() {
  const linkClasses = 'transition-colors hover:text-white';

  return (
    <footer className="bg-bears-navy py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center text-slate-300">
          <p className="text-sm font-medium tracking-wide text-slate-300/90 sm:text-base">
            &copy; 2026 Bears Prediction Tracker. All rights reserved.
          </p>
          <div className="mx-auto mt-6 h-px w-full max-w-xl bg-white/10" />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300/90 sm:text-base">
            <Link to="/privacy" className={linkClasses}>
              Privacy Policy
            </Link>
            <span className="text-slate-400/80">|</span>
            <Link to="/terms" className={linkClasses}>
              Terms of Service
            </Link>
            <span className="text-slate-400/80">|</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClasses}>
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
