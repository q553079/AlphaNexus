import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  computeVirtualWindowLayout,
  computeVirtualWindowRange,
} from './modules/session-virtual-window'

type VirtualItem<T> = {
  id: string
  data: T
}

type SessionEventVirtualListProps<T> = {
  estimatedHeight?: number
  items: Array<VirtualItem<T>>
  overscan?: number
  renderItem: (item: T) => ReactNode
}

const defaultEstimatedHeight = 172

export const SessionEventVirtualList = <T,>({
  estimatedHeight = defaultEstimatedHeight,
  items,
  overscan = 4,
  renderItem,
}: SessionEventVirtualListProps<T>) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({})

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }

    const updateViewportHeight = () => {
      setViewportHeight(node.clientHeight)
    }

    updateViewportHeight()
    const observer = new ResizeObserver(updateViewportHeight)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  const layout = useMemo(() => {
    return computeVirtualWindowLayout(items, measuredHeights, estimatedHeight)
  }, [estimatedHeight, items, measuredHeights])

  const visibleRange = useMemo(() => {
    return computeVirtualWindowRange(items, measuredHeights, layout, {
      estimatedHeight,
      overscan,
      scrollTop,
      viewportHeight,
    })
  }, [estimatedHeight, items, layout.offsets, measuredHeights, overscan, scrollTop, viewportHeight])

  const visibleItems = visibleRange.endIndex >= visibleRange.startIndex
    ? items
      .slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, offset) => ({
        index: visibleRange.startIndex + offset,
        item,
      }))
    : []

  return (
    <div
      className="session-workbench__event-list session-workbench__event-virtual-list"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      ref={containerRef}
    >
      <div className="session-workbench__event-virtual-spacer" style={{ height: layout.totalHeight }}>
        {visibleItems.map(({ index, item }) => {
          const top = layout.offsets[index] ?? 0

          return (
            <MeasuredVirtualItem
              id={item.id}
              key={item.id}
              onResize={(height) => {
                setMeasuredHeights((current) => current[item.id] === height
                  ? current
                  : {
                    ...current,
                    [item.id]: height,
                  })
              }}
              top={top}
            >
              {renderItem(item.data)}
            </MeasuredVirtualItem>
          )
        })}
      </div>
    </div>
  )
}

type MeasuredVirtualItemProps = {
  children: ReactNode
  id: string
  onResize: (height: number) => void
  top: number
}

const MeasuredVirtualItem = ({
  children,
  id,
  onResize,
  top,
}: MeasuredVirtualItemProps) => {
  const itemRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = itemRef.current
    if (!node) {
      return
    }

    const emit = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height)
      if (nextHeight > 0) {
        onResize(nextHeight)
      }
    }

    emit()
    const observer = new ResizeObserver(emit)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [id, onResize])

  return (
    <div className="session-workbench__event-virtual-item" ref={itemRef} style={{ top }}>
      {children}
    </div>
  )
}
