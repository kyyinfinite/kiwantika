import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap, motionDuration, motionEase, prefersReducedMotion } from '../../lib/motion'

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
}

export function Reveal({ children, className = '', delay = 0, y = 28, once = true }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: motionDuration,
          delay,
          ease: motionEase,
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 88%',
            once,
          },
        },
      )
    }, ref)

    return () => ctx.revert()
  }, [delay, once, y])

  return <div ref={ref} className={className}>{children}</div>
}

export function Stagger({ children, className = '', selector = '[data-stagger-item]' }: { children: ReactNode; className?: string; selector?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current!.querySelectorAll(selector),
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.09,
          ease: motionEase,
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 86%',
            once: true,
          },
        },
      )
    }, ref)

    return () => ctx.revert()
  }, [selector])

  return <div ref={ref} className={className}>{children}</div>
}
