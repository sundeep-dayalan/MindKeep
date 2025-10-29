import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

const PlasmoOverlay = () => {
  return null
}

export default PlasmoOverlay

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTED_HTML") {
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const container = document.createElement("div")
      container.appendChild(range.cloneContents())

      sendResponse({
        html: container.innerHTML,
        text: selection.toString()
      })
    } else {
      sendResponse({ html: "", text: "" })
    }

    return true
  }
})
