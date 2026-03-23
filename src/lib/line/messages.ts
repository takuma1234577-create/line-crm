export function textMessage(text: string) {
  return { type: 'text' as const, text }
}

export function imageMessage(originalContentUrl: string, previewImageUrl: string) {
  return { type: 'image' as const, originalContentUrl, previewImageUrl }
}

export function flexMessage(altText: string, contents: any) {
  return { type: 'flex' as const, altText, contents }
}

export function buttonTemplate(title: string, text: string, actions: any[]) {
  return {
    type: 'template' as const,
    altText: title,
    template: { type: 'buttons', title, text, actions },
  }
}
