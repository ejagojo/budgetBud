'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

interface CountUpProps {
  value: number
  duration?: number
  format?: (value: number) => string
  className?: string
}

export function CountUp({
  value,
  duration = 1000,
  format = (val) => val.toLocaleString(),
  className
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const motionValue = useMotionValue(0)

  const rounded = useTransform(motionValue, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: duration / 1000,
      ease: "easeOut",
    })

    return controls.stop
  }, [motionValue, value, duration])

  useEffect(() => {
    const unsubscribe = rounded.on("change", (latest) => {
      setDisplayValue(latest)
    })

    return () => unsubscribe()
  }, [rounded])

  return (
    <motion.span className={className}>
      {format(displayValue)}
    </motion.span>
  )
}
