import { marked } from "marked"

import { logger } from "~utils/logger"

export async function markdownToTipTapHTML(markdown: string): Promise<string> {
  try {
    const html = await marked.parse(markdown, {
      gfm: true,
      breaks: true
    })

    logger.log(" [Markdown→HTML] Conversion successful")
    return html
  } catch (error) {
    logger.error(" [Markdown→HTML] Conversion failed:", error)

    return `<p>${markdown}</p>`
  }
}

export function isMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m,
    /^\*\s/m,
    /^\d+\.\s/m,
    /\*\*.*\*\*/m,
    /\*.*\*/m,
    /\[.*\]\(.*\)/m,
    /^>\s/m,
    /^```/m // Code blocks
  ]

  return markdownPatterns.some((pattern) => pattern.test(text))
}
