export type SelectionFormattingAction = 'bold' | 'quote' | 'bullet'

export type SelectionFormattingResult = {
  nextSelectionEnd: number
  nextSelectionStart: number
  nextValue: string
}

export const applySelectionFormatting = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: SelectionFormattingAction,
): SelectionFormattingResult => {
  const selected = value.slice(selectionStart, selectionEnd)
  const nextText = selected || '文本'

  if (action === 'bold') {
    return {
      nextSelectionEnd: selectionStart + nextText.length + 4,
      nextSelectionStart: selectionStart + 2,
      nextValue: `${value.slice(0, selectionStart)}**${nextText}**${value.slice(selectionEnd)}`,
    }
  }

  if (action === 'quote') {
    const quoted = nextText
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join('\n')
    return {
      nextSelectionEnd: selectionStart + quoted.length,
      nextSelectionStart: selectionStart,
      nextValue: `${value.slice(0, selectionStart)}${quoted}${value.slice(selectionEnd)}`,
    }
  }

  const bulleted = nextText
    .split(/\r?\n/)
    .map((line) => `- ${line}`)
    .join('\n')

  return {
    nextSelectionEnd: selectionStart + bulleted.length,
    nextSelectionStart: selectionStart,
    nextValue: `${value.slice(0, selectionStart)}${bulleted}${value.slice(selectionEnd)}`,
  }
}
