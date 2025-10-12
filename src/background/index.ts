// Main background script for MindKeep
// Handles side panel opening and context menu actions

export {}

// Listen for extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  
  // Open the side panel for the current tab
  await chrome.sidePanel.open({ tabId: tab.id })
})

console.log("MindKeep background script loaded")
