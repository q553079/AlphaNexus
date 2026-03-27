import { useEffect, useRef, useState } from 'react'

type LazyImageProps = {
  alt: string
  aspectRatio?: string
  className?: string
  rootMargin?: string
  src: string
}

export const LazyImage = ({
  alt,
  aspectRatio = '16 / 9',
  className,
  rootMargin = '180px',
  src,
}: LazyImageProps) => {
  const [visible, setVisible] = useState(false)
  const placeholderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = placeholderRef.current
    if (!node) {
      return
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin })

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [rootMargin])

  if (visible) {
    return <img alt={alt} className={className} decoding="async" loading="lazy" src={src} />
  }

  return (
    <div
      aria-label={alt}
      className={['lazy-image__placeholder', className].filter(Boolean).join(' ')}
      ref={placeholderRef}
      style={{ aspectRatio }}
    />
  )
}
