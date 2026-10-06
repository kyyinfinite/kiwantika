import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap, ScrollTrigger, motionDuration, motionEase, prefersReducedMotion } from '../../lib/motion'
import { useGsapEffect } from '../../hooks/useGsapEffect'

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  x?: number
  once?: boolean
  scrub?: boolean
  parallax?: number
}

export function Reveal({
  children,
  className = '',
  delay = 0,
  y = 28,
  x = 0,
  once = true,
  scrub = false,
  parallax = 0,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || prefersReducedMotion()) return

    let raf = 0
    const ctx = gsap.context(() => {
      const fromVars = { autoAlpha: 0, x, y, willChange: 'transform,opacity' }
      const toVars = {
        autoAlpha: 1,
        x: 0,
        y: 0,
        duration: motionDuration,
        delay,
        ease: 'power4.out',
        clearProps: 'willChange',
      }

      if (scrub) {
        gsap.fromTo(node, fromVars, {
          ...toVars,
          scrollTrigger: {
            trigger: node,
            start: 'top 88%',
            end: 'bottom 55%',
            scrub: 0.8,
          },
        })
      } else {
        const reveal = gsap.fromTo(node, fromVars, { ...toVars, paused: true })
        ScrollTrigger.create({
          trigger: node,
          start: 'top 88%',
          once,
          onEnter: () => reveal.play(),
          onEnterBack: () => reveal.play(),
        })

        // If the browser restores a deep mobile scroll position, explicitly
        // evaluate the trigger after layout so content cannot stay at autoAlpha 0.
        raf = requestAnimationFrame(() => {
          ScrollTrigger.refresh()
          const rect = node.getBoundingClientRect()
          if (rect.top < window.innerHeight * 0.88 && rect.bottom > 0) reveal.play()
        })
      }


      raf = raf || requestAnimationFrame(() => ScrollTrigger.refresh())

      if (parallax) {
        gsap.to(node, {
          y: parallax,
          ease: 'none',
          scrollTrigger: {
            trigger: node,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.1,
          },
        })
      }
    }, ref)

    return () => {
      cancelAnimationFrame(raf)
      ctx.revert()
    }
  }, [delay, once, y, x, scrub, parallax])

  return <div ref={ref} className={className}>{children}</div>
}

export function Stagger({
  children,
  className = '',
  selector = '[data-stagger-item]',
}: {
  children: ReactNode
  className?: string
  selector?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGsapEffect(ref, () => {
    const node = ref.current
    if (!node || prefersReducedMotion()) return
    const items = node.querySelectorAll(selector)
    if (!items.length) return

    gsap.fromTo(items,
      { autoAlpha: 0, y: 26, rotateX: -4, transformOrigin: '50% 100%' },
      {
        autoAlpha: 1,
        y: 0,
        rotateX: 0,
        duration: 0.78,
        stagger: { each: 0.075, from: 'start' },
        ease: 'power4.out',
        clearProps: 'transform,opacity,willChange',
        scrollTrigger: {
          trigger: node,
          start: 'top 86%',
          once: true,
        },
      },
    )
  }, [selector])

  return <div ref={ref} className={className}>{children}</div>
}
