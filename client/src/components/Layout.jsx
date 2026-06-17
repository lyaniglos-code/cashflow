import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

// Reveal cards as they scroll into view. Robust against React StrictMode's
// double-invoked effects and async-loaded content: cards already in the
// viewport reveal immediately, off-screen cards reveal on scroll, and the whole
// thing re-arms idempotently on every route change.
function useScrollReveal(rootRef, deps) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hasIO = typeof IntersectionObserver !== 'undefined';

    let i = 0;
    const io = hasIO
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) {
                e.target.classList.add('in');
                io.unobserve(e.target);
              }
            }
          },
          { threshold: 0.04, rootMargin: '0px 0px -3% 0px' }
        )
      : null;

    const register = (el) => {
      if (el.classList.contains('in')) return;
      // Apply the hidden/staggered styling once.
      if (!el.dataset.revealArmed) {
        el.dataset.revealArmed = '1';
        el.classList.add('reveal');
        el.style.transitionDelay = `${Math.min(i++, 6) * 55}ms`;
      }
      // If already in view, reveal immediately (next frame so the transition
      // plays). Otherwise (re)observe with the CURRENT live observer — this is
      // safe to repeat and survives StrictMode's disconnect/re-run.
      const r = el.getBoundingClientRect();
      const inView = r.top < window.innerHeight * 0.97 && r.bottom > 0;
      if (inView || !io) {
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
      } else {
        io.observe(el);
      }
    };

    const scan = () => root.querySelectorAll('.card').forEach(register);
    scan();

    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });

    // Safety net: anything still hidden shortly after load gets revealed.
    const failsafe = setTimeout(() => {
      root.querySelectorAll('.card.reveal:not(.in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 700);

    return () => {
      clearTimeout(failsafe);
      io && io.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Layout({ children, title, subtitle, actions }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Reset scroll to top on navigation for a clean entrance.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0 });
  }, [pathname]);

  useScrollReveal(mainRef, [pathname]);

  return (
    <div className="flex h-full">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-charcoal-900/80 px-4 py-3.5 backdrop-blur lg:px-8">
          <button className="btn-ghost px-2.5 py-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-white lg:text-xl">{title}</h1>
            {subtitle && <p className="truncate text-xs text-slate-400 lg:text-sm">{subtitle}</p>}
          </div>
          {actions}
        </header>
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-7">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
