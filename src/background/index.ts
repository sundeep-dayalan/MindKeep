// Main background script for MindKeep
// Handles side panel opening and context menu actions

export {}

// Track side panel state per tab
const sidePanelState = new Map<number, boolean>()

// Listen for extension icon click to toggle side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  const tabId = tab.id
  const isOpen = sidePanelState.get(tabId) || false

  if (isOpen) {
    // Close the side panel by setting it to a different path temporarily
    // Note: Chrome's sidePanel API doesn't have a direct close method
    // The user needs to click the X or click outside manually
    // We can only toggle the extension behavior
    sidePanelState.set(tabId, false)
  } else {
    // Open the side panel for the current tab
    await chrome.sidePanel.open({ tabId: tabId })
    sidePanelState.set(tabId, true)
  }
})

// Clean up state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelState.delete(tabId)
})

console.log("MindKeep background script loaded")
