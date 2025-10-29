import type { Step } from "react-joyride"

/**
 * Tour steps for the Side Panel
 * These guide users through all the main features of MindKeep
 */
export const sidePanelTourSteps: Step[] = [
  {
    target: "body",
    content:
      "Welcome to MindKeep! Let me show you around your personal AI-powered second brain. This tour will take about 2 minutes.",
    placement: "center",
    disableBeacon: true
  },
  {
    target: '[data-tour="header-logo"]',
    content:
      "This is MindKeep - your intelligent note-taking companion that works 100% locally on your device.",
    placement: "bottom"
  },
  {
    target: '[data-tour="search-button"]',
    content:
      "Use this search to quickly find notes by title or content. It's perfect for keyword-based searches.",
    placement: "bottom"
  },
  {
    target: '[data-tour="new-note-button"]',
    content:
      "Click here to create a new note. You can add rich text, images, tables, code blocks, and more!",
    placement: "bottom"
  },
  {
    target: '[data-tour="close-button"]',
    content: "Close the side panel anytime by clicking here.",
    placement: "bottom"
  },
  {
    target: '[data-tour="ai-status-banner"]',
    content:
      "This banner shows the status of your local AI models. Make sure Gemini Nano is ready for the best experience!",
    placement: "bottom",
    spotlightClicks: false
  },
  {
    target: '[data-tour="category-tabs"]',
    content:
      "Organize your notes with categories. Switch between 'All' and specific categories to filter your notes.",
    placement: "bottom"
  },
  {
    target: '[data-tour="note-card"]',
    content:
      "Each note card shows a preview. Click the edit icon to modify or the delete icon to remove it.",
    placement: "top",
    spotlightClicks: false
  },
  {
    target: '[data-tour="ai-search-bar"]',
    content:
      "🎯 This is where the magic happens! Ask questions in natural language and the AI will search your notes semantically - it understands meaning, not just keywords.",
    placement: "top"
  },
  {
    target: '[data-tour="persona-selector"]',
    content:
      "Switch between AI personas here. Each persona is tailored for specific tasks like writing emails, coding help, or meeting summaries.",
    placement: "top"
  },
  {
    target: '[data-tour="ai-search-input"]',
    content:
      'Try asking things like "What\'s my Netflix password?" or "Show me notes about AWS deployment". The AI will find relevant notes and provide intelligent answers.',
    placement: "top"
  },
  {
    target: "body",
    content:
      "💡 Pro tip: You can also create notes directly by saying 'Save this as a note: [your content]' in the AI search!",
    placement: "center"
  },
  {
    target: "body",
    content:
      "That's it for the side panel! Next, let's see how to use the in-page AI assistant on any website.",
    placement: "center"
  }
]

/**
 * Tour steps for the In-Page Chat Modal
 * These guide users through using AI assistance directly on web pages
 */
export const inPageChatTourSteps: Step[] = [
  {
    target: "body",
    content:
      "Welcome to the In-Page AI Assistant! This powerful feature lets you use MindKeep on any website.",
    placement: "center",
    disableBeacon: true
  },
  {
    target: '[data-tour="in-page-icon"]',
    content:
      "When you focus on any input field (text box, textarea), you'll see this MindKeep icon appear nearby.",
    placement: "bottom"
  },
  {
    target: '[data-tour="in-page-modal"]',
    content:
      "Click the icon to open this floating AI chat. You can drag it anywhere on the screen!",
    placement: "top"
  },
  {
    target: '[data-tour="in-page-ai-search"]',
    content:
      "Ask the AI anything! It has access to all your notes and can help you with writing, finding information, or generating content.",
    placement: "top"
  },
  {
    target: '[data-tour="insert-button"]',
    content:
      "After the AI responds, click 'Insert' to automatically place the text into the input field you were focused on. Perfect for filling forms, writing emails, or composing messages!",
    placement: "top"
  },
  {
    target: "body",
    content:
      "💡 Examples:\n• Email: 'Write a professional email declining a meeting'\n• Code: 'What's the Python code for reading CSV files?'\n• Forms: 'What's my company address?'\n• Social: 'Suggest a LinkedIn post about my recent project'",
    placement: "center"
  },
  {
    target: "body",
    content:
      "You're all set! Explore MindKeep and let it become your trusted second brain. 🧠✨",
    placement: "center"
  }
]

/**
 * Quick tour with just the essential features (optional, shorter version)
 */
export const quickTourSteps: Step[] = [
  {
    target: "body",
    content:
      "Welcome to MindKeep! This quick tour highlights the key features.",
    placement: "center",
    disableBeacon: true
  },
  {
    target: '[data-tour="new-note-button"]',
    content: "Create notes with rich formatting, images, tables, and more.",
    placement: "bottom"
  },
  {
    target: '[data-tour="ai-search-bar"]',
    content:
      "Ask questions naturally - the AI understands meaning, not just keywords.",
    placement: "top"
  },
  {
    target: "body",
    content:
      "💡 Bonus: Focus on any input field on the web to see the MindKeep icon - click it for instant AI help!",
    placement: "center"
  },
  {
    target: "body",
    content: "You're ready to go! Happy note-taking! 🎉",
    placement: "center"
  }
]

/**
 * Tour steps for the In-Page Chat Assistant
 * Short and focused tour for the floating AI modal
 */
export const inPageAssistantTourSteps: Step[] = [
  {
    target: '[data-tour="in-page-modal"]',
    content:
      "👋 Welcome! This is your In-Page AI Assistant by MindKeep. Let me show you how it works! You can drag this modal anywhere on the page.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: false
  },
  {
    target: '[data-tour="persona-selector"]',
    content:
      "Choose different AI personas for specific tasks - Email Writer, Code Helper, Meeting Summarizer, and more!",
    placement: "bottom"
  },
  {
    target: '[data-tour="ai-search-input"]',
    content:
      'Ask anything! Try:\n• "What\'s my Netflix password?"\n• "Write an email declining a meeting"\n• "Summarize my AWS deployment notes"',
    placement: "top"
  },
  {
    target: '[data-tour="insert-button"]',
    content:
      "🎯 The magic button! After the AI responds, click Insert to automatically place the text into the input field.\n\n💡 Pro tip: The AI can access all your saved notes to help answer questions!",
    placement: "top"
  },
  {
    target: '[data-tour="in-page-modal"]',
    content:
      "That's it! You're ready to use your AI assistant. Click the ? button anytime to see this tour again. 🚀",
    placement: "top",
    spotlightClicks: false
  }
]
