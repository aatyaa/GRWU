/**
 * Adds .is-revealed to every [data-reveal] element the first time it scrolls into view, so
 * figures build up when the reader reaches them (the CSS lives in base.css and only applies
 * with JavaScript and without reduced motion).
 */
const observer =
  typeof IntersectionObserver === 'undefined'
    ? undefined
    : new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-revealed');
            observer?.unobserve(entry.target);
          }
        },
        { rootMargin: '0px 0px -12% 0px' },
      );

for (const element of document.querySelectorAll('[data-reveal]')) {
  if (observer) observer.observe(element);
  else element.classList.add('is-revealed');
}
