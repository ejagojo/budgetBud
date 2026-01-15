'use client'

import { motion } from 'framer-motion'
import { Button, ButtonProps } from './button'
import { forwardRef } from 'react'

interface MotionButtonProps extends ButtonProps {
  children: React.ReactNode
}

const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 17
        }}
      >
        <Button ref={ref} {...props}>
          {children}
        </Button>
      </motion.div>
    )
  }
)

MotionButton.displayName = "MotionButton"

export { MotionButton }

