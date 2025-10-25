/**
 * TipTap JSON to Markdown Converter
 * 
 * Converts TipTap's rich text JSON format to clean, structured Markdown.
 * This preserves formatting, structure, and context while being highly readable for AI.
 * 
 * Benefits over plain text:
 * - Preserves headings, lists, tables, code blocks
 * - Maintains emphasis (bold, italic, code)
 * - Keeps links with URLs
 * - Retains structure and hierarchy
 * - AI can better understand context
 */

interface TipTapNode {
  type: string
  attrs?: Record<string, any>
  content?: TipTapNode[]
  text?: string
  marks?: Array<{
    type: string
    attrs?: Record<string, any>
  }>
}

interface TipTapDoc {
  type: "doc"
  content: TipTapNode[]
}

/**
 * Main conversion function
 */
export function tiptapToMarkdown(json: string | TipTapDoc): string {
  try {
    const doc: TipTapDoc = typeof json === "string" ? JSON.parse(json) : json
    
    if (!doc || doc.type !== "doc" || !doc.content) {
      return ""
    }

    return convertNodes(doc.content).trim()
  } catch (error) {
    console.error("Failed to convert TipTap to Markdown:", error)
    return ""
  }
}

/**
 * Convert array of nodes to markdown
 */
function convertNodes(nodes: TipTapNode[], context?: { inTable?: boolean; inList?: boolean }): string {
  return nodes.map((node) => convertNode(node, context)).join("")
}

/**
 * Convert a single node to markdown
 */
function convertNode(node: TipTapNode, context?: { inTable?: boolean; inList?: boolean }): string {
  switch (node.type) {
    case "paragraph":
      return convertParagraph(node, context)
    
    case "heading":
      return convertHeading(node)
    
    case "text":
      return convertText(node)
    
    case "codeBlock":
      return convertCodeBlock(node)
    
    case "blockquote":
      return convertBlockquote(node)
    
    case "bulletList":
      return convertBulletList(node)
    
    case "orderedList":
      return convertOrderedList(node)
    
    case "listItem":
      return convertListItem(node, context)
    
    case "table":
      return convertTable(node)
    
    case "tableRow":
      return convertTableRow(node)
    
    case "tableCell":
    case "tableHeader":
      return convertTableCell(node)
    
    case "hardBreak":
      return "  \n" // Markdown line break
    
    case "horizontalRule":
      return "\n---\n\n"
    
    case "image":
      return convertImage(node)
    
    default:
      // Fallback: process children if they exist
      if (node.content) {
        return convertNodes(node.content, context)
      }
      return ""
  }
}

/**
 * Convert paragraph node
 */
function convertParagraph(node: TipTapNode, context?: { inTable?: boolean }): string {
  if (!node.content || node.content.length === 0) {
    return context?.inTable ? "" : "\n"
  }
  
  const content = convertNodes(node.content)
  
  // In tables, don't add extra newlines
  if (context?.inTable) {
    return content
  }
  
  return content + "\n\n"
}

/**
 * Convert heading node
 */
function convertHeading(node: TipTapNode): string {
  const level = node.attrs?.level || 1
  const hashes = "#".repeat(level)
  const content = node.content ? convertNodes(node.content) : ""
  return `${hashes} ${content}\n\n`
}

/**
 * Convert text node with marks (bold, italic, code, links)
 */
function convertText(node: TipTapNode): string {
  let text = node.text || ""
  
  if (!node.marks || node.marks.length === 0) {
    return text
  }
  
  // Apply marks in reverse order for proper nesting
  for (const mark of node.marks.reverse()) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`
        break
      
      case "italic":
        text = `*${text}*`
        break
      
      case "code":
        text = `\`${text}\``
        break
      
      case "link":
        const href = mark.attrs?.href || ""
        text = `[${text}](${href})`
        break
      
      case "strike":
        text = `~~${text}~~`
        break
      
      case "underline":
        // Markdown doesn't have native underline, use emphasis
        text = `_${text}_`
        break
    }
  }
  
  return text
}

/**
 * Convert code block
 */
function convertCodeBlock(node: TipTapNode): string {
  const language = node.attrs?.language || ""
  const content = node.content ? convertNodes(node.content) : ""
  return `\`\`\`${language}\n${content}\n\`\`\`\n\n`
}

/**
 * Convert blockquote
 */
function convertBlockquote(node: TipTapNode): string {
  const content = node.content ? convertNodes(node.content) : ""
  // Split by lines and prefix each with >
  const lines = content.trim().split("\n")
  const quoted = lines.map((line) => `> ${line}`).join("\n")
  return `${quoted}\n\n`
}

/**
 * Convert bullet list
 */
function convertBulletList(node: TipTapNode): string {
  const items = node.content ? convertNodes(node.content, { inList: true }) : ""
  return items + "\n"
}

/**
 * Convert ordered list
 */
function convertOrderedList(node: TipTapNode): string {
  const items = node.content ? convertNodes(node.content, { inList: true }) : ""
  return items + "\n"
}

/**
 * Convert list item
 */
function convertListItem(node: TipTapNode, context?: { inList?: boolean }): string {
  const content = node.content ? convertNodes(node.content) : ""
  // Remove trailing newlines from content for cleaner list formatting
  const cleanContent = content.trim()
  
  // Use - for bullet points (could also detect ordered vs unordered from parent)
  return `- ${cleanContent}\n`
}

/**
 * Convert table
 */
function convertTable(node: TipTapNode): string {
  if (!node.content || node.content.length === 0) {
    return ""
  }
  
  const rows = node.content.map((row) => convertNode(row, { inTable: true }))
  
  // Add header separator after first row
  if (rows.length > 0) {
    // Count columns from first row to create separator
    const firstRow = node.content[0]
    const colCount = firstRow.content?.length || 0
    const separator = "|" + " --- |".repeat(colCount) + "\n"
    
    return rows[0] + separator + rows.slice(1).join("")
  }
  
  return rows.join("") + "\n"
}

/**
 * Convert table row
 */
function convertTableRow(node: TipTapNode): string {
  if (!node.content) {
    return "|\n"
  }
  
  const cells = node.content.map((cell) => convertNode(cell, { inTable: true }))
  return "| " + cells.join(" | ") + " |\n"
}

/**
 * Convert table cell
 */
function convertTableCell(node: TipTapNode): string {
  if (!node.content) {
    return ""
  }
  
  const content = convertNodes(node.content, { inTable: true })
  // Remove newlines within cells
  return content.trim().replace(/\n/g, " ")
}

/**
 * Convert image node
 */
function convertImage(node: TipTapNode): string {
  const src = node.attrs?.src || ""
  const alt = node.attrs?.alt || "image"
  const title = node.attrs?.title
  
  if (title) {
    return `![${alt}](${src} "${title}")\n\n`
  }
  
  return `![${alt}](${src})\n\n`
}

/**
 * Extract plain text only (fallback for simple use cases)
 */
export function tiptapToPlainText(json: string | TipTapDoc): string {
  try {
    const doc: TipTapDoc = typeof json === "string" ? JSON.parse(json) : json
    
    if (!doc || doc.type !== "doc" || !doc.content) {
      return ""
    }

    return extractText(doc.content).trim()
  } catch (error) {
    console.error("Failed to extract plain text from TipTap:", error)
    return ""
  }
}

/**
 * Recursively extract text from nodes
 */
function extractText(nodes: TipTapNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.text || ""
      }
      
      if (node.content) {
        return extractText(node.content)
      }
      
      // Add space for hard breaks
      if (node.type === "hardBreak") {
        return " "
      }
      
      return ""
    })
    .join("")
}
