import { useCallback, useMemo, useState } from 'react'

type HistoryState<T> = {
  past: T[]
  present: T
  future: T[]
}

type UseUndoRedoStateOptions<T> = {
  equals?: (left: T, right: T) => boolean
}

const defaultEquals = <T,>(left: T, right: T) => JSON.stringify(left) === JSON.stringify(right)

export const useUndoRedoState = <T,>(
  initialValue: T,
  options: UseUndoRedoStateOptions<T> = {},
) => {
  const equals = options.equals ?? defaultEquals
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialValue,
    future: [],
  })

  const setValue = useCallback((nextValue: T) => {
    setHistory((current) => {
      if (equals(current.present, nextValue)) {
        return current
      }

      return {
        past: [...current.past, current.present],
        present: nextValue,
        future: [],
      }
    })
  }, [equals])

  const reset = useCallback((nextValue: T) => {
    setHistory({
      past: [],
      present: nextValue,
      future: [],
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) {
        return current
      }

      const previous = current.past[current.past.length - 1]
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) {
        return current
      }

      const [next, ...rest] = current.future
      return {
        past: [...current.past, current.present],
        present: next,
        future: rest,
      }
    })
  }, [])

  return useMemo(() => ({
    canRedo: history.future.length > 0,
    canUndo: history.past.length > 0,
    redo,
    reset,
    setValue,
    undo,
    value: history.present,
  }), [history.future.length, history.past.length, history.present, redo, reset, setValue, undo])
}
