# Desktop App Test Checklist

## Pre-Test Setup

- [ ] Start server: `cd tools/desktop-app && node server.cjs`
- [ ] Open browser: http://localhost:3000
- [ ] Open browser console (F12)
- [ ] Check for JavaScript errors

## Knowledge Module Tests

### Basic Functionality
- [ ] Click "Knowledge" icon - window opens
- [ ] Click "+ Ny Note" - editor appears
- [ ] Enter title: "Test Knowledge Item"
- [ ] Select category: "madkontrollen"
- [ ] Enter tags: "test, firebase, rutiner"
- [ ] Enter content: "This is a test knowledge item"
- [ ] Click "Gem" - alert shows "Knowledge item gemt"
- [ ] Item appears in sidebar list
- [ ] Click item in list - editor loads with correct data

### Search & Filter
- [ ] Enter search term in search box - list filters correctly
- [ ] Select category filter - list shows only matching items
- [ ] Clear search - all items visible again

### Copy & Export
- [ ] Click "Kopiér" - alert shows "Indhold kopieret"
- [ ] Paste clipboard - content matches
- [ ] Click "Export JSON" - file downloads
- [ ] Open JSON file - valid structure

### Import
- [ ] Click "Import JSON" - file picker opens
- [ ] Select exported JSON file
- [ ] Alert shows "Importeret X items"
- [ ] Items appear in list

### Delete
- [ ] Select an item
- [ ] Click "Slet" - confirm dialog appears
- [ ] Confirm - item removed from list
- [ ] Check localStorage: `localStorage.getItem('tools.knowledge.items')`

## Prompts Module Tests

### Basic Functionality
- [ ] Click "Prompts" icon - window opens
- [ ] Click "+ Ny Prompt" - editor appears
- [ ] Enter title: "Test Prompt"
- [ ] Select category: "windsurf"
- [ ] Enter tags: "debug, fix"
- [ ] Enter content: "Fix the bug in rutiner.html"
- [ ] Click "Gem" - alert shows "Prompt gemt"
- [ ] Item appears in sidebar list

### Search & Filter
- [ ] Search works correctly
- [ ] Category filter works correctly

### Copy & Export
- [ ] Copy button works
- [ ] Export JSON works
- [ ] Import JSON works

### Delete
- [ ] Delete works
- [ ] localStorage updated

## Operations Module Tests

### Basic Functionality
- [ ] Click "Operations" icon - window opens
- [ ] Click "+ Ny Task" - editor appears
- [ ] Enter title: "Deploy Checklist"
- [ ] Select category: "deploy"
- [ ] Enter tags: "firebase, hosting"
- [ ] Enter content: "1. Test locally\n2. Deploy functions\n3. Deploy hosting"
- [ ] Click "Gem" - alert shows "Operation gemt"
- [ ] Item appears in sidebar list

### Search & Filter
- [ ] Search works correctly
- [ ] Category filter works correctly

### Copy & Export
- [ ] Copy button works
- [ ] Export JSON works
- [ ] Import JSON works

### Delete
- [ ] Delete works
- [ ] localStorage updated

## Existing Modules Tests

### Explorer
- [ ] Click "Explorer" icon - window opens
- [ ] "Load files" button works
- [ ] File selection works
- [ ] Editor loads content
- [ ] Save works

### Splitter
- [ ] Click "Splitter" icon - window opens
- [ ] File path input works
- [ ] Split button works
- [ ] Output displays correctly

### Smart Merge
- [ ] Click "Smart Merge" icon - window opens
- [ ] Textarea is editable

### Firma Import
- [ ] Click "CVR Firma Import" icon - window opens
- [ ] File import works
- [ ] Search works
- [ ] Batch navigation works
- [ ] CRM integration works

## Window System Tests

### Dragging
- [ ] Click and drag titlebar - window moves
- [ ] Window stays within viewport
- [ ] Multiple windows can be dragged

### Resizing
- [ ] Drag window corner - window resizes
- [ ] Min-width/min-height enforced
- [ ] Content adjusts to new size

### Z-Index
- [ ] Click window - brings to front
- [ ] Multiple windows stack correctly

### Close
- [ ] Click X button - window closes
- [ ] Window removed from DOM

## localStorage Persistence Tests

### Knowledge
- [ ] Create item
- [ ] Refresh page
- [ ] Open Knowledge module
- [ ] Item still exists

### Prompts
- [ ] Create item
- [ ] Refresh page
- [ ] Open Prompts module
- [ ] Item still exists

### Operations
- [ ] Create item
- [ ] Refresh page
- [ ] Open Operations module
- [ ] Item still exists

## Browser Console Tests

- [ ] No JavaScript errors on page load
- [ ] No errors when opening modules
- [ ] No errors when creating items
- [ ] No errors when saving items
- [ ] No errors when deleting items
- [ ] localStorage keys exist:
  - `tools.knowledge.items`
  - `tools.prompts.items`
  - `tools.operations.items`

## Cross-Module Tests

- [ ] Open all 3 new modules simultaneously
- [ ] All windows draggable
- [ ] All windows resizable
- [ ] No conflicts between modules
- [ ] localStorage keys don't overlap

## Data Integrity Tests

### JSON Structure
- [ ] Export from Knowledge - valid JSON
- [ ] Export from Prompts - valid JSON
- [ ] Export from Operations - valid JSON
- [ ] All exports have correct structure:
  ```json
  [{
    "id": "string",
    "title": "string",
    "category": "string",
    "content": "string",
    "tags": ["array"],
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }]
  ```

### Import Validation
- [ ] Import invalid JSON - shows error
- [ ] Import non-array JSON - shows error
- [ ] Import valid JSON - works correctly

## Edge Cases

- [ ] Create item with empty title - works
- [ ] Create item with empty content - works
- [ ] Create item with no category - works
- [ ] Create item with no tags - works
- [ ] Search with special characters - works
- [ ] Very long content (10000+ chars) - works
- [ ] Multiple items with same title - works

## Performance Tests

- [ ] Create 100 knowledge items - UI responsive
- [ ] Search in 100 items - fast results
- [ ] Export 100 items - completes quickly
- [ ] Import 100 items - completes quickly

## Final Checks

- [ ] All onclick handlers work
- [ ] No duplicate function names
- [ ] No console errors
- [ ] localStorage data persists
- [ ] Export/Import round-trip works
- [ ] All existing modules still work
- [ ] Desktop icons properly aligned
- [ ] UI is responsive
- [ ] No visual glitches

## Test Results

Date: ___________
Tester: ___________

Passed: _____ / _____
Failed: _____ / _____

Notes:
___________________________________________
___________________________________________
___________________________________________
