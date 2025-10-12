# MindKeep AI Agent Development Instructions

## Project Goal

Your primary objective is to build a privacy-first Chrome extension called MindKeep. This extension will function as a personal AI assistant and "second brain," allowing users to save, manage, and retrieve notes using on-device AI models.

## Core Philosophy

Adhere to these principles throughout the development process:

- **100% On-Device:** No user data or AI inference requests should ever be sent to any external server. All processing must happen locally within the user's browser.
- **Privacy First:** All user-generated content must be encrypted at rest.
- **Dual Interface:** The user experience is split between a fast Command Palette for retrieval and a full-featured Side Panel for management.

## 1. Technology Stack

Set up the project using the following technologies:

- Framework: Plasmo (for Chrome extension development)
- Language: TypeScript
- UI Library: React
- On-Device NLU: Google's chrome.ai API (for Gemini Nano)
- On-Device Embeddings: @xenova/transformers.js
- Vector Database: chromadb-ts
- Persistent Storage: IndexedDB (managed by chromadb-ts and custom wrappers)
- Package Manager: pnpm

## 2. Directory & File Structure

Organize the project with the following structure. This is critical for modularity and maintainability.

mind-keep/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── assets/
│ └── icon.png
├── background/
│ ├── index.ts # Main background script entry
│ └── messages/ # Defines message passing contracts
│ └── index.ts
├── components/ # Shared React components
│ ├── Note.tsx
│ └── CategoryPill.tsx
├── contents/
│ └── command-palette.tsx # Content script to inject the command palette
├── sidepanel.tsx # Main React component for the side panel UI
├── popup.tsx # Optional: A simple popup for the extension icon
├── services/ # Core logic modules
│ ├── ai-service.ts # Handles Gemini Nano & embeddings
│ └── db-service.ts # Manages all database interactions
└── util/
└── crypto.ts # Wrapper for SubtleCrypto API

## 3. Phase 1: Project Setup & Core Services

### Initialize Project:

- Create a new directory mindkeep-extension.
- Initialize a Plasmo project: `pnpm create plasmo --with-pnpm`
- Select the "React + TypeScript" template.

### Install Dependencies:

- `pnpm add @xenova/transformers chromadb-ts`

### Setup Core Services (services/):

#### crypto.ts:

- Create functions `encrypt(text: string): Promise<string>` and `decrypt(encryptedText: string): Promise<string>` using the SubtleCrypto Web API. Abstract key management away.

#### db-service.ts:

- Initialize a ChromaClient instance.
- Define the data schema for a "Note" (id, title, content (encrypted), category, embedding, createdAt, sourceUrl).
- Implement the following async functions:
  - `addNote(noteData)`: Encrypts content, generates an embedding, and saves to Chroma/IndexedDB.
  - `getNote(id)`: Retrieves and decrypts a single note.
  - `updateNote(id, updatedData)`: Updates and re-encrypts note data.
  - `deleteNote(id)`: Removes a note.
  - `getAllNotes()`: Retrieves and decrypts all notes.
  - `searchNotesByVector(vector)`: Performs a vector search and returns decrypted notes.
  - `searchNotesByTitle(query)`: Performs a simple text search on the title.

#### ai-service.ts:

- Create a singleton class `EmbeddingPipeline` using @xenova/transformers.js (Xenova/all-MiniLM-L6-v2 model) to handle embedding generation.
- Create a function `getIntent(query: string): Promise<'fill' | 'display'>` that uses the chrome.ai API (Gemini Nano) to classify user intent. The prompt should guide the model to output one of the two words.

## 4. Phase 2: The Side Panel for Note Management

### Configure chrome.sidePanel:

- In plasmo.json or the manifest override, enable the sidePanel API and set the default path to `sidepanel.html`.

### Build the UI (sidepanel.tsx):

- Create a multi-component React application for the side panel.
- **Main View:**
  - Display a list of all notes, fetched from db-service.
  - Include a search bar for filtering by title.
  - Include a dropdown for filtering by category.
  - Each note in the list should be editable and deletable.
  - Provide a "Create New Note" button.
- **Editor View:**
  - A form with fields for title, category, and content.
  - This view is used for both creating new notes and editing existing ones.

### Implement CRUD Logic:

- Wire up the UI components to call the respective functions in db-service.ts.
- Ensure state management in React correctly reflects database changes.

## 5. Phase 3: Context Menu Integration

### Create Context Menu:

- In the main background script (background/index.ts), use the `chrome.runtime.onInstalled` event to create a context menu item.
- id: `saveToMindKeep`
- title: "Save to MindKeep"
- contexts: ["selection"]

### Implement onClicked Listener:

- Add a listener for `chrome.contextMenus.onClicked`.
- When the `saveToMindKeep` item is clicked:
  - Check for `selectionText`.
  - Call `chrome.sidePanel.open()`.
  - Send a message to the side panel runtime with the `selectionText`.
- The `sidepanel.tsx` component should have a listener that, upon receiving this message, switches to the "Editor View" and pre-fills the content with the selected text.

## 6. Phase 4: The Command Palette

### Configure Command Shortcut:

- In the manifest, define a command using the `chrome.commands` API.
- name: `_execute_browser_action`
- suggested_key: `Ctrl+Shift+Space` (use MacCtrl for Mac)
- Note: Using `+SPACE` alone is not valid, so `Ctrl+Shift+Space` is recommended.

### Build the UI (contents/command-palette.tsx):

- This is a content script that injects a floating React component (a div with position: fixed and a high z-index).
- The UI should be a simple input bar.

### Implement the Workflow:

- The background script listens for the command shortcut.
- When triggered, it sends a message to the active tab's content script to "show" the command palette.
- The content script tracks the last focused input element on the page.
- As the user types in the command palette, the query is sent to the background script.
- The background script uses ai-service and db-service in parallel to get the intent and search for notes.
- Results are sent back to the command palette UI for display.
- If the user selects a "Fill" action, a message is sent to the content script with the text to be inserted. The content script then fills the last focused input element.

## 7. Final Testing Checklist

Verify the following functionality:

- [ ] Extension icon click opens the side panel.
- [ ] Implement crypto.ts (encryption utilities)
- [ ] Implement db-service.ts (database operations)
- [ ] Implement ai-service.ts (AI and embeddings)
- [ ] Build full Side Panel UI with note management
- [ ] Add context menu integration

- [ ] Side panel correctly displays, creates, edits, and deletes notes
- [ ] Highlighting text and right-clicking shows "Save to MindKeep"
- [ ] Clicking the context menu item opens the side panel with text pre-filled
- [ ] The keyboard shortcut (Ctrl+Shift+Space) opens the Command Palette
- [ ] Typing a query like "my ssn" displays the result in the palette
- [ ] Typing a query like "fill my ssn" pastes the result into a text field
- [ ] All user data is verifiably stored in IndexedDB and encrypted
- [ ] The extension works correctly offline

- [ ] Side panel correctly displays, creates, edits, and deletes notes.
- [ ] Highlighting text and right-clicking shows "Save to MindKeep."
- [ ] Clicking the context menu item opens the side panel with the text pre-filled.
- [ ] The keyboard shortcut (Ctrl+Shift+Space) opens the Command Palette.
- [ ] Typing a query like my ssn displays the result in the palette.
- [ ] Typing a query like fill my ssn pastes the result into a text field.
- [ ] All user data is verifiably stored in IndexedDB and is not human-readable (encrypted).
- [ ] The extension works correctly offline.
