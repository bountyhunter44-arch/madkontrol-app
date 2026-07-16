# RUTINER.HTML INTEGRATION GUIDE

## Step 1: Add CSS Link in <head>

Find the `<head>` section and add after existing CSS:

```html
<link rel="stylesheet" href="/css/process-cards.css">
```

## Step 2: Add Process Section in <body>

Find the section where tasks are displayed (around line 200-300) and add BEFORE the task list:

```html
<!-- Active Process Instances Section -->
<section id="active-processes-section" style="display: none; margin-bottom: 24px;">
  <h2>🔥 Aktive processer</h2>
  <div id="active-processes-list">
    <!-- Process cards will be rendered here dynamically -->
  </div>
</section>

<!-- Start Process Actions -->
<section id="process-actions" style="margin-bottom: 24px;">
  <button id="btn-start-cooling" type="button">
    🧊 Start nedkøling
  </button>
</section>
```

## Step 3: Add Scripts Before </body>

Find the closing `</body>` tag and add BEFORE it:

```html
<!-- Process Instances -->
<script src="/core/processInstances.js"></script>
<script src="/modules/egenkontrol/process-dashboard.js"></script>
</body>
```

## Step 4: Update loadPageData() Function

Find the `loadPageData()` function and ensure it calls process refresh:

```javascript
async function loadPageData() {
    // ... existing code ...
    
    // Load active processes
    if (window.MKP && window.MKP.ProcessDashboard) {
        await window.MKP.ProcessDashboard.refresh();
    }
    
    // ... rest of existing code ...
}
```

## Complete Example

Here's what the relevant sections should look like:

```html
<!DOCTYPE html>
<html lang="da">
<head>
    <!-- ... existing head content ... -->
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/process-cards.css">
</head>
<body>
    <!-- ... existing content ... -->
    
    <!-- Active Process Instances Section -->
    <section id="active-processes-section" style="display: none; margin-bottom: 24px;">
        <h2>🔥 Aktive processer</h2>
        <div id="active-processes-list"></div>
    </section>

    <!-- Start Process Actions -->
    <section id="process-actions" style="margin-bottom: 24px;">
        <button id="btn-start-cooling" type="button">
            🧊 Start nedkøling
        </button>
    </section>
    
    <!-- Existing task list -->
    <div id="task-list">
        <!-- ... existing task rendering ... -->
    </div>
    
    <!-- ... existing scripts ... -->
    
    <!-- Process Instances -->
    <script src="/core/processInstances.js"></script>
    <script src="/modules/egenkontrol/process-dashboard.js"></script>
</body>
</html>
```

## Testing

1. Open rutiner.html in browser
2. Click "🧊 Start nedkøling"
3. Fill in form and submit
4. Process card should appear in "Aktive processer" section
5. Click "Tilføj måling" to add intermediate measurement
6. Click "Afslut nedkøling" and enter temperature > 10°C to trigger failure
7. Recovery options should appear
8. Click "🔥 Genopvarm til 75°C"
9. Reheating card should appear
10. Complete reheating with temp >= 75°C
11. Option to start new cooling should appear
12. Start new cooling and complete successfully
13. All completed processes should disappear from active list
