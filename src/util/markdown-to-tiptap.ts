/**
 * Utility to convert Markdown to TipTap HTML
 * This allows AI-generated markdown summaries to be rendered with rich formatting
 */

import { marked } from "marked"

/**
 * Convert markdown text to HTML that TipTap can parse
 *
 * @param markdown - Markdown string (e.g., AI-generated summary)
 * @returns HTML string that can be passed to editor.setContent()
 */
export async function markdownToTipTapHTML(markdown: string): Promise<string> {
  try {
    // Parse markdown to HTML using marked
    const html = await marked.parse(markdown, {
      gfm: true, // GitHub Flavored Markdown
      breaks: true // Convert line breaks to <br>
    })

    console.log("✨ [Markdown→HTML] Conversion successful")
    return html
  } catch (error) {
    console.error("❌ [Markdown→HTML] Conversion failed:", error)
    // Fallback: return markdown wrapped in paragraph
    return `<p>${markdown}</p>`
  }
}

/**
 * Simple helper to check if content is likely markdown
 */
export function isMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m, // Headings
    /^\*\s/m, // Unordered lists
    /^\d+\.\s/m, // Ordered lists
    /\*\*.*\*\*/m, // Bold
    /\*.*\*/m, // Italic
    /\[.*\]\(.*\)/m, // Links
    /^>\s/m, // Blockquotes
    /^```/m // Code blocks
  ]

  return markdownPatterns.some((pattern) => pattern.test(text))
}
