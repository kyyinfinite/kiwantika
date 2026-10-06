import { useLayoutEffect, type DependencyList, type RefObject } from 'react'
import { gsap, prefersReducedMotion, ScrollTrigger } from '../lib/motion'

/**
 * React-safe GSAP effect.
 * Uses gsap.context() for cleanup and refreshes ScrollTrigger after layout settles.
 * Animates transforms/opacity only by default to avoid layout shift.
 */
export function useGsapEffect(
  scope: RefObject<HTMLElement | null>,
  effect: () => void,
  deps: DependencyList = [],
) {
  useLayoutEffect(() => {
    const target = scope.current
    if (!target || prefersReducedMotion()) return

    const ctx = gsap.context(effect, target)
    const refresh = () => ScrollTrigger.refresh()

    const raf = requestAnimationFrame(refresh)
    window.addEventListener('load', refresh, { once: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('load', refresh)
      ctx.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
