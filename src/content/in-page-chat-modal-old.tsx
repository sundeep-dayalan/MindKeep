// /**
//  * In-Page Chat Modal
//  *
//  * Compact floating chat interface that appears near input fields.
//  * Supports streaming AI responses and text insertion.
//  */

// import React, { useEffect, useRef, useState } from 'react'

// import { PersonaSelector } from '~components/PersonaSelector'
// import { RichTextEditor, type RichTextEditorRef } from '~components/RichTextEditor'
// import { getGlobalAgent } from '~services/langchain-agent'
// import type { Persona } from '~types/persona'

// interface InPageChatModalProps {
//   position: { top: number; left: number }
//   onClose: () => void
//   onInsert: (text: string) => void
//   inputFieldContent: string // Current content of the input field for context
// }

// interface Message {
//   role: 'user' | 'assistant'
//   content: string
// }

// export function InPageChatModal({
//   position,
//   onClose,
//   onInsert,
//   inputFieldContent
// }: InPageChatModalProps) {
//   const [messages, setMessages] = useState<Message[]>([])
//   const [isProcessing, setIsProcessing] = useState(false)
//   const [currentResponse, setCurrentResponse] = useState('')
//   const [isStreaming, setIsStreaming] = useState(false)
//   const [showInsertButton, setShowInsertButton] = useState(false)

//   const editorRef = useRef<RichTextEditorRef>(null)
//   const messagesEndRef = useRef<HTMLDivElement>(null)

//   // Auto-scroll to bottom when messages change
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
//   }, [messages, currentResponse])

//   // Initialize with input field content as context if provided
//   useEffect(() => {
//     if (inputFieldContent && inputFieldContent.trim()) {
//       console.log('📝 [InPageChat] Input field context:', inputFieldContent.substring(0, 100))
//     }
//   }, [inputFieldContent])

//   const handleSubmit = async (e?: React.FormEvent) => {
//     e?.preventDefault()

//     const query = editorRef.current?.getText()?.trim() || ''
//     if (!query || isProcessing) return

//     // Add user message
//     const userMessage: Message = { role: 'user', content: query }
//     setMessages((prev) => [...prev, userMessage])

//     // Clear input
//     editorRef.current?.setContent('')

//     // Start processing
//     setIsProcessing(true)
//     setCurrentResponse('')
//     setShowInsertButton(false)

//     try {
//       const agent = await getGlobalAgent()

//       // Build conversation history
//       const conversationHistory = messages.map((m) => ({
//         role: m.role === 'user' ? 'user' : 'assistant',
//         content: m.content
//       }))

//       // Add input field content as context if available
//       let contextualQuery = query
//       if (inputFieldContent && inputFieldContent.trim()) {
//         contextualQuery = `Context from input field: "${inputFieldContent}"\n\nUser query: ${query}`
//       }

//       // Add current query
//       conversationHistory.push({ role: 'user', content: contextualQuery })

//       // Stream the response
//       setIsStreaming(true)
//       let fullResponse = ''

//       const stream = agent.runStream(contextualQuery, conversationHistory)

//       for await (const chunk of stream) {
//         if (chunk.type === 'chunk') {
//           fullResponse += chunk.data as string
//           setCurrentResponse(fullResponse)
//         } else if (chunk.type === 'complete') {
//           const response = chunk.data as any
//           fullResponse = response.aiResponse || fullResponse
//           setCurrentResponse(fullResponse)
//         }
//       }

//       setIsStreaming(false)

//       // Add assistant message
//       const assistantMessage: Message = { role: 'assistant', content: fullResponse }
//       setMessages((prev) => [...prev, assistantMessage])
//       setCurrentResponse('')

//       // Show insert button after response completes
//       setShowInsertButton(true)
//     } catch (error) {
//       console.error('[InPageChat] Error:', error)
//       const errorMessage: Message = {
//         role: 'assistant',
//         content: 'Sorry, I encountered an error. Please try again.'
//       }
//       setMessages((prev) => [...prev, errorMessage])
//       setIsStreaming(false)
//     } finally {
//       setIsProcessing(false)
//     }
//   }

//   const handleInsertResponse = () => {
//     // Get the last assistant message
//     const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant')

//     if (lastAssistantMessage) {
//       onInsert(lastAssistantMessage.content)
//       // Close modal after insertion
//       setTimeout(() => onClose(), 300)
//     }
//   }

//   const handleInsertHover = (isHovering: boolean) => {
//     // Emit event to content script to highlight text in input field
//     const event = new CustomEvent('mindkeep-highlight-insert', {
//       detail: { highlight: isHovering }
//     })
//     window.dispatchEvent(event)
//   }

//   const handlePersonaChange = async (persona: Persona | null) => {
//     console.log('[InPageChat] Persona changed:', persona?.name || 'Default')

//     try {
//       const agent = await getGlobalAgent()
//       await agent.setPersona(persona)

//       // Clear messages when switching personas
//       setMessages([])
//       setCurrentResponse('')
//       setShowInsertButton(false)
//     } catch (error) {
//       console.error('[InPageChat] Error changing persona:', error)
//     }
//   }

//   return (
//     <div
//       style={{
//         position: 'fixed',
//         top: `${position.top}px`,
//         left: `${position.left}px`,
//         width: '400px',
//         maxHeight: '500px',
//         zIndex: 999999,
//         backgroundColor: 'rgba(255, 255, 255, 0.95)',
//         backdropFilter: 'blur(20px)',
//         borderRadius: '16px',
//         boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
//         border: '1px solid rgba(255, 255, 255, 0.4)',
//         display: 'flex',
//         flexDirection: 'column',
//         overflow: 'hidden'
//       }}>
//       {/* Header */}
//       <div
//         style={{
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//           padding: '12px 16px',
//           borderBottom: '1px solid rgba(226, 232, 240, 0.5)'
//         }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//           <div
//             style={{
//               width: '8px',
//               height: '8px',
//               backgroundColor: '#22c55e',
//               borderRadius: '50%',
//               animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
//             }}
//           />
//           <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>MindKeep AI</span>
//         </div>
//         <button
//           onClick={onClose}
//           style={{
//             padding: '4px',
//             borderRadius: '8px',
//             color: '#94a3b8',
//             background: 'transparent',
//             border: 'none',
//             cursor: 'pointer',
//             transition: 'all 0.2s'
//           }}
//           onMouseEnter={(e) => {
//             e.currentTarget.style.color = '#334155'
//             e.currentTarget.style.backgroundColor = '#f1f5f9'
//           }}
//           onMouseLeave={(e) => {
//             e.currentTarget.style.color = '#94a3b8'
//             e.currentTarget.style.backgroundColor = 'transparent'
//           }}>
//           <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//           </svg>
//         </button>
//       </div>
//           className="plasmo-p-1 plasmo-rounded-lg plasmo-text-slate-400 hover:plasmo-text-slate-700 hover:plasmo-bg-slate-100 plasmo-transition-colors">
//           <svg className="plasmo-w-5 plasmo-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//           </svg>
//         </button>
//       </div>

//       {/* Messages */}
//       <div
//         className="plasmo-overflow-y-auto plasmo-px-4 plasmo-py-3 plasmo-space-y-3"
//         style={{ maxHeight: '300px' }}>
//         {messages.length === 0 && !currentResponse && (
//           <div className="plasmo-text-center plasmo-text-sm plasmo-text-slate-500 plasmo-py-8">
//             Ask me anything...
//           </div>
//         )}

//         {messages.map((message, index) => (
//           <div
//             key={index}
//             className={`plasmo-flex ${message.role === 'user' ? 'plasmo-justify-end' : 'plasmo-justify-start'}`}>
//             <div
//               className={`plasmo-px-3 plasmo-py-2 plasmo-rounded-lg plasmo-text-sm plasmo-max-w-[85%] ${
//                 message.role === 'user'
//                   ? 'plasmo-bg-slate-900 plasmo-text-white'
//                   : 'plasmo-bg-blue-50 plasmo-text-slate-900'
//               }`}>
//               <div className="plasmo-whitespace-pre-wrap plasmo-break-words">{message.content}</div>
//             </div>
//           </div>
//         ))}

//         {/* Streaming response */}
//         {currentResponse && (
//           <div className="plasmo-flex plasmo-justify-start">
//             <div className="plasmo-px-3 plasmo-py-2 plasmo-rounded-lg plasmo-text-sm plasmo-max-w-[85%] plasmo-bg-blue-50 plasmo-text-slate-900">
//               <div className="plasmo-whitespace-pre-wrap plasmo-break-words">{currentResponse}</div>
//               {isStreaming && (
//                 <span className="plasmo-inline-block plasmo-w-1 plasmo-h-4 plasmo-bg-slate-900 plasmo-ml-1 plasmo-animate-pulse" />
//               )}
//             </div>
//           </div>
//         )}

//         {/* Loading indicator */}
//         {isProcessing && !isStreaming && !currentResponse && (
//           <div className="plasmo-flex plasmo-justify-start">
//             <div className="plasmo-px-3 plasmo-py-2 plasmo-rounded-lg plasmo-bg-blue-50">
//               <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
//                 <div className="plasmo-w-2 plasmo-h-2 plasmo-bg-slate-400 plasmo-rounded-full plasmo-animate-bounce" />
//                 <div
//                   className="plasmo-w-2 plasmo-h-2 plasmo-bg-slate-400 plasmo-rounded-full plasmo-animate-bounce"
//                   style={{ animationDelay: '0.2s' }}
//                 />
//                 <div
//                   className="plasmo-w-2 plasmo-h-2 plasmo-bg-slate-400 plasmo-rounded-full plasmo-animate-bounce"
//                   style={{ animationDelay: '0.4s' }}
//                 />
//               </div>
//             </div>
//           </div>
//         )}

//         <div ref={messagesEndRef} />
//       </div>

//       {/* Input */}
//       <div className="plasmo-border-t plasmo-border-slate-200/50 plasmo-px-4 plasmo-py-3">
//         <form onSubmit={handleSubmit} className="plasmo-space-y-2">
//           <div className="plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-slate-200 plasmo-p-2">
//             <RichTextEditor
//               ref={editorRef}
//               placeholder="Ask or type instructions..."
//               showToolbar={false}
//               compact={true}
//               onSubmit={handleSubmit}
//             />
//           </div>

//           <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-2">
//             {/* Persona Selector */}
//             <div className="plasmo-flex-shrink-0">
//               <PersonaSelector onPersonaChange={handlePersonaChange} />
//             </div>

//             {/* Action Buttons */}
//             <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
//               {showInsertButton && (
//                 <button
//                   type="button"
//                   onClick={handleInsertResponse}
//                   onMouseEnter={() => handleInsertHover(true)}
//                   onMouseLeave={() => handleInsertHover(false)}
//                   className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-green-600 plasmo-text-white plasmo-text-sm plasmo-rounded-lg hover:plasmo-bg-green-700 plasmo-transition-colors plasmo-font-medium">
//                   Insert
//                 </button>
//               )}
//               <button
//                 type="submit"
//                 disabled={isProcessing}
//                 className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-900 plasmo-text-white plasmo-text-sm plasmo-rounded-lg hover:plasmo-bg-slate-700 plasmo-transition-colors disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed">
//                 {showInsertButton ? 'Send' : 'Ask'}
//               </button>
//             </div>
//           </div>
//         </form>
//       </div>
//     </div>
//   )
// }
