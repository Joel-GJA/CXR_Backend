import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

export function WordRotate({
  words,
  duration = 2500,
  motionProps = {
    initial:    { opacity: 0, y: -28 },
    animate:    { opacity: 1, y: 0   },
    exit:       { opacity: 0, y: 28  },
    transition: { duration: 0.28, ease: 'easeOut' },
  },
  className,
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!words || words.length === 0) return;
    setIndex(0);  // reset when words array changes so we don't render a stale index
    if (words.length <= 1) return;
    const t = setInterval(() => setIndex(i => (i + 1) % words.length), duration);
    return () => clearInterval(t);
  }, [words, duration]);

  return (
    <div className="overflow-hidden py-1">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          className={cn('inline-block', className)}
          {...motionProps}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
