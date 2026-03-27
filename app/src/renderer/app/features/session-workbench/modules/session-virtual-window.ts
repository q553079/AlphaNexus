export type VirtualWindowItem = {
  id: string
}

export type VirtualWindowLayout = {
  offsets: number[]
  totalHeight: number
}

export type VirtualWindowRange = {
  endIndex: number
  startIndex: number
}

export const computeVirtualWindowLayout = (
  items: VirtualWindowItem[],
  measuredHeights: Record<string, number>,
  estimatedHeight: number,
): VirtualWindowLayout => {
  const offsets: number[] = []
  let totalHeight = 0

  items.forEach((item, index) => {
    offsets[index] = totalHeight
    totalHeight += measuredHeights[item.id] ?? estimatedHeight
  })

  return {
    offsets,
    totalHeight,
  }
}

export const computeVirtualWindowRange = (
  items: VirtualWindowItem[],
  measuredHeights: Record<string, number>,
  layout: VirtualWindowLayout,
  input: {
    estimatedHeight: number
    overscan: number
    scrollTop: number
    viewportHeight: number
  },
): VirtualWindowRange => {
  if (items.length === 0) {
    return {
      endIndex: -1,
      startIndex: 0,
    }
  }

  const overscanStart = Math.max(0, input.scrollTop - input.estimatedHeight * input.overscan)
  const overscanEnd = input.scrollTop
    + Math.max(input.viewportHeight, input.estimatedHeight)
    + input.estimatedHeight * input.overscan

  let startIndex = 0
  while (
    startIndex < items.length
    && layout.offsets[startIndex] + (measuredHeights[items[startIndex].id] ?? input.estimatedHeight) < overscanStart
  ) {
    startIndex += 1
  }

  let endIndex = startIndex
  while (endIndex < items.length && layout.offsets[endIndex] < overscanEnd) {
    endIndex += 1
  }

  return {
    endIndex: Math.min(items.length - 1, endIndex),
    startIndex,
  }
}
