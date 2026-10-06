# KIWANTIKA — Design Polish Phase

## Focus
This phase intentionally stays in the frontend/design layer. No routes, auth, Supabase schema, or content structure are changed.

### Footer behavior
- `#root` is a vertical flex frame with a minimum viewport height.
- `main#konten` grows to consume remaining viewport space.
- `footer` remains in normal document flow and is never fixed/absolute.
- Short pages therefore place the footer at the viewport bottom without leaving a white tail underneath.
- Long pages naturally push the footer below the content.
- Mobile safe-area bottom padding is retained.

### Visual direction
- Editorial application canvas with subtle grid texture.
- Stronger typographic hierarchy for management pages.
- Softer glass/paper surfaces rather than heavy generic shadows.
- Layered brand-derived shadows.
- More intentional hover states for content rows and navigation.
- Management pages receive a quiet green/gold accent line and improved page rhythm.

### Mobile
- Admin headings stack cleanly.
- Action groups become touch-friendly.
- Tables remain horizontally scrollable rather than compressing columns into unreadable content.
- Cards preserve breathing room while avoiding unnecessary blank space.

## Next design-only phase
Recommended next work: global page transitions, scroll choreography, and a unified motion preset system before adding more visual effects.
