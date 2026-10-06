# KIWANTIKA Frontend Bespoke Refresh

This refresh preserves routes, content structure, brand assets, and existing Supabase/auth behavior.

## Changed
- `src/styles/app.css`: expanded design tokens and responsive container scale.
- `src/styles/kiwantika.css`: editorial grid, restrained glass, layered brand-derived shadows, subtle noise, responsive depth.
- `src/components/motion/Reveal.tsx`: GSAP context + ScrollTrigger reveal/parallax and stronger stagger.
- `src/hooks/useGsapEffect.ts`: reusable React-safe GSAP/ScrollTrigger lifecycle helper.
- `src/app/App.tsx`: route-level organic transition between public/member/admin views.
- `src/features/assistant/AssistantWidget.tsx`: magnetic 3D launcher micro-interaction.
- `src/features/auth/GoogleSignInButton.tsx`: restrained pointer tilt micro-interaction.
- `src/lib/motion.ts`: heavier premium easing defaults.

## Motion safety
All scroll motion respects `prefers-reduced-motion`. Animated properties are limited to transform/opacity/clip-path so the redesign avoids intentional layout shifts.

## Verification
The source was statically sanity-checked in the provided environment. A full `npm run build` could not be completed because dependency installation timed out in the execution environment; no claim of a successful production build is made here.
