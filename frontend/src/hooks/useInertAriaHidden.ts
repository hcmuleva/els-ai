import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Web-only a11y fix for a React Navigation stack-transition gap: while a screen
 * animates out, its DOM is kept mounted and marked `aria-hidden="true"`, but its
 * buttons/links keep their native `tabindex` — so a keyboard user tabbing through
 * the page can land on invisible, non-functional "ghost" controls from a previous
 * screen (surfaced by `agent-browser a11y` as an `aria-hidden-focus` finding).
 *
 * The standard fix (and the one browsers/AT actually respect) is the native
 * `inert` attribute, which removes an `aria-hidden` subtree from both the tab
 * order and the accessibility tree in one step. This observes the DOM for any
 * `aria-hidden="true"` element (regardless of which library or screen produced
 * it) and keeps `inert` in sync with it, rather than patching react-navigation.
 */
export default function useInertAriaHidden() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const sync = (el: Element) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.getAttribute('aria-hidden') === 'true') {
        if (!el.hasAttribute('inert')) el.setAttribute('inert', '');
      } else if (el.hasAttribute('inert')) {
        el.removeAttribute('inert');
      }
    };

    const syncSubtree = (root: ParentNode) => {
      root.querySelectorAll('[aria-hidden="true"]').forEach(sync);
    };

    syncSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          sync(mutation.target);
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              sync(node);
              syncSubtree(node);
            }
          });
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);
}
