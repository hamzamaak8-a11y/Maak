import { Platform } from 'react-native';
import { IS_ADMIN_PORTAL } from '../config/env';

/**
 * Mobile browsers report a viewport height that includes the collapsible address bar / home-indicator area, which pushes
 * the bottom of a full-height app (our tab bar) under the browser chrome. Use the dynamic viewport unit and opt into
 * safe-area insets so the tab bar is always fully visible.
 */
export function setupWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  const content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  if (meta) meta.setAttribute('content', content);
  else { const m = document.createElement('meta'); m.name = 'viewport'; m.content = content; document.head.appendChild(m); }
  const style = document.createElement('style');
  style.textContent = [
    'html,body,#root{height:100%;min-height:100%}',
    '@supports (height:100dvh){html,body,#root{height:100dvh;min-height:100dvh}}',
    'html,body{overflow-x:hidden}',
    'body{overscroll-behavior:none;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}',
  ].join('');
  document.head.appendChild(style);
  document.title = IS_ADMIN_PORTAL ? 'Maak Admin' : 'Maak';
  if (IS_ADMIN_PORTAL) {
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(robots);
  }
}
