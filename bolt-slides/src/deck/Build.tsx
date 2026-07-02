import { motion } from 'framer-motion'
import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useDeck } from './DeckContext'

/* Click-build (the Slidev "v-click"): this element stays hidden until the
   presenter advances to step `at` (1-based) on the current slide, then it
   animates in. Reveal content in beats: <Build at={1}>…</Build>. The deck
   advances builds before moving to the next slide.

   In AUTO mode (Deck autoplay / the dock auto button / "A"), every build
   instead animates in automatically on slide load, staggered by `at`. */
export default function Build({
  at = 1, y = 16, children, className, style,
}: {
  at?: number
  y?: number
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const { clicks, isStatic, auto, stagger = 0.16, registerMax } = useDeck()
  useEffect(() => { registerMax?.(at) }, [at, registerMax])

  if (isStatic) return <div className={className} style={style}>{children}</div>

  if (auto) {
    return (
      <motion.div
        className={className}
        style={style}
        initial={{ opacity: 0, y, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.12 + (at - 1) * stagger }}
      >
        {children}
      </motion.div>
    )
  }

  const shown = clicks >= at
  return (
    <motion.div
      className={className}
      style={{ ...style, pointerEvents: shown ? 'auto' : 'none' }}
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : y, filter: shown ? 'blur(0px)' : 'blur(3px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
