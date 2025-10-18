# Custom Agent Implementation Backup

**Date:** October 18, 2025  
**Reason:** Migrating to LangGraph.js for better reliability and maintenance

## What Was This?

This is a custom LangGraph-inspired multi-pass agent system built specifically for the MindKeep Chrome extension. It worked 100% offline using Google's Gemini Nano API.

## Architecture

### Core Components:

1. **graph-engine.ts** - The orchestration engine
   - Managed iterative supervisor → persona → supervisor loops
   - Handled state management with `GraphState` interface
   - Implemented infinite loop detection
   - Tracked created notes during pipeline execution

2. **supervisor-service.ts** - AI-powered routing
   - Used Gemini Nano to classify notes
   - Matched notes to appropriate personas based on trigger prompts
   - Deterministic routing with temperature=0.3, topK=1

3. **persona-executor.ts** - Action execution engine
   - Generated structured JSON actions using Gemini Nano
   - Built context from previous actions
   - Enforced single-action-per-iteration execution
   - Implemented failure detection with helpful hints

4. **agent-pipeline.ts** - Main pipeline orchestrator
   - Integrated graph engine with background script
   - Managed persona installation and updates
   - Handled agent settings (enabled/disabled, max iterations, logging)

### Features Implemented:

✅ Multi-pass iterative execution (max 10 global iterations)  
✅ Conditional persona routing based on note content  
✅ Single-action-per-iteration constraint  
✅ In-memory note tracking (createdNotes array)  
✅ Infinite loop detection (same persona 3x in a row)  
✅ Rich context display with failure hints  
✅ Permission-based tool execution  
✅ Comprehensive execution logging  

## Why We Migrated to LangGraph

### Issues We Fixed During Development:

1. ❌ **Dexie Query Bug**: Boolean queries required `.toArray().filter()` workaround
2. ❌ **Gemini Nano API**: Had to add both `temperature` AND `topK` together
3. ❌ **MaxIterations Too Low**: Initial value of 1 prevented multi-step workflows
4. ❌ **Context Visibility**: AI couldn't see previous action results clearly
5. ❌ **Multi-Action Planning**: AI tried to plan multiple actions at once
6. ❌ **Infinite Loops**: AI repeated failed operations without learning
7. ❌ **Duplicate Creation**: Find couldn't see notes created during same pipeline

### Benefits of LangGraph:

✅ **Battle-tested**: Used by Uber, Replit, LinkedIn, GitLab in production  
✅ **Professional maintenance**: Expert team handles edge cases  
✅ **Community support**: Thousands of developers using and testing  
✅ **Future-proof**: Automatic updates when APIs change  
✅ **Better patterns**: Standard state management and routing  

### Trade-offs:

- Bundle size: +1.27 MB (from 1.01 MB to 2.20 MB)
- But: More reliable, less maintenance burden, better long-term support

## Custom Implementation Stats:

- **Total Lines**: ~800 lines of TypeScript
- **Development Time**: ~6 hours initial + 4 hours debugging
- **Bundle Size**: ~50 KB overhead
- **Status**: Fully functional but requires ongoing maintenance

## What Worked Great:

✅ **persona-toolkit.ts** - Kept this! Sandboxed tools work perfectly  
✅ **default-personas.ts** - Kept this! Persona definitions are excellent  
✅ **All UI components** - Kept everything! No changes needed  

## Key Learnings:

1. **Tree-shaking is real**: LangGraph only adds what you use
2. **Browser compatibility**: Modern packages DO work in extensions with proper bundlers
3. **Custom vs Framework**: Sometimes paying the bundle size tax is worth it for reliability
4. **Gemini Nano quirks**: Temperature + topK must be specified together
5. **State management**: Tracking in-memory state during pipeline execution is critical

## If You Want to Restore This:

```bash
# Copy files back
cp backup-custom-implementation/*.ts src/services/

# Update background/index.ts to import from agent-pipeline
# The system should work as before
```

## Notes for Future Reference:

The custom implementation demonstrates that building a LangGraph-inspired system for Chrome extensions is **absolutely possible** and can be done in ~1000 lines of code. However, the maintenance burden and edge cases make using the official LangGraph.js library a better long-term choice for production applications.

The core insight that enabled this: **Modern bundlers + tree-shaking make "heavy" libraries viable in Chrome extensions.**

---

**This code is preserved for educational purposes and as a fallback if needed.**
