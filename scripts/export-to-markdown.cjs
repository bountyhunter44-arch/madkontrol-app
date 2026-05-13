/**
 * Export Project Files to Markdown for Analysis
 * Creates .md files in scan-export/ folder
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'scan-export');
const PROJECT_ROOT = path.join(__dirname, '..');

// Files and directories to export
const EXPORT_PATTERNS = {
  functions: [
    'functions/egenkontrol/**/*.js',
    'functions/admin/**/*.js',
    'functions/index.js',
    'functions/guideLibrary.js',
    'functions/guideResolver.js'
  ],
  public: [
    'public/modules/egenkontrol/rutiner.html',
    'public/modules/egenkontrol/rutiner-cooling-ui.js',
    'public/scripts/*.cjs'
  ],
  scripts: [
    'scripts/*.js',
    'scripts/*.cjs'
  ],
  config: [
    'package.json',
    'firebase.json',
    'firestore.rules',
    'firestore.indexes.json'
  ],
  docs: [
    'COOLING_CONTROL_ARCHITECTURE.md',
    'COOLING_LEARNING_MODEL.md',
    'README.md'
  ]
};

// Language mapping for code blocks
const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.cjs': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.rules': 'javascript',
  '.yaml': 'yaml',
  '.yml': 'yaml'
};

/**
 * Get language for code block based on file extension
 */
function getLanguage(filePath) {
  const ext = path.extname(filePath);
  return LANGUAGE_MAP[ext] || 'text';
}

/**
 * Convert file path to markdown filename
 * Example: functions/egenkontrol/guideLibrary.js -> functions_egenkontrol_guideLibrary.js.md
 */
function pathToMarkdownFilename(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const normalized = relativePath.replace(/\\/g, '/');
  const mdName = normalized.replace(/\//g, '_') + '.md';
  return mdName;
}

/**
 * Create markdown content for a file
 */
function createMarkdownContent(filePath, content) {
  const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  const language = getLanguage(filePath);
  
  return `# FILE: ${relativePath}

\`\`\`${language}
${content}
\`\`\`
`;
}

/**
 * Recursively find files matching glob-like pattern
 */
function findFiles(baseDir, pattern) {
  const results = [];
  
  // Simple glob implementation
  const parts = pattern.split('/');
  
  function traverse(currentDir, remainingParts) {
    if (remainingParts.length === 0) return;
    
    const part = remainingParts[0];
    const rest = remainingParts.slice(1);
    
    if (!fs.existsSync(currentDir)) return;
    
    if (part === '**') {
      // Recursive wildcard
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Continue recursively
          traverse(fullPath, remainingParts);
          traverse(fullPath, rest);
        } else if (rest.length === 1 && matchPattern(entry.name, rest[0])) {
          results.push(fullPath);
        }
      }
    } else if (part.includes('*')) {
      // Wildcard in current level
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (rest.length === 0 && entry.isFile() && matchPattern(entry.name, part)) {
          results.push(fullPath);
        } else if (rest.length > 0 && entry.isDirectory() && matchPattern(entry.name, part)) {
          traverse(fullPath, rest);
        }
      }
    } else {
      // Exact match
      const fullPath = path.join(currentDir, part);
      
      if (rest.length === 0 && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        results.push(fullPath);
      } else if (rest.length > 0) {
        traverse(fullPath, rest);
      }
    }
  }
  
  traverse(baseDir, parts);
  return results;
}

/**
 * Match filename against pattern with wildcards
 */
function matchPattern(filename, pattern) {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(filename);
}

/**
 * Export all files to markdown
 */
function exportToMarkdown() {
  console.log('📦 Starting export to markdown...\n');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
  } else {
    console.log(`📁 Using existing directory: ${OUTPUT_DIR}\n`);
  }
  
  let totalFiles = 0;
  let exportedFiles = 0;
  let skippedFiles = 0;
  
  // Process each category
  for (const [category, patterns] of Object.entries(EXPORT_PATTERNS)) {
    console.log(`\n📂 Processing category: ${category}`);
    
    for (const pattern of patterns) {
      const files = findFiles(PROJECT_ROOT, pattern);
      
      for (const filePath of files) {
        totalFiles++;
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const mdContent = createMarkdownContent(filePath, content);
          const mdFilename = pathToMarkdownFilename(filePath);
          const outputPath = path.join(OUTPUT_DIR, mdFilename);
          
          fs.writeFileSync(outputPath, mdContent, 'utf8');
          
          const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
          console.log(`   ✅ ${relativePath} → ${mdFilename}`);
          exportedFiles++;
          
        } catch (error) {
          console.error(`   ❌ Failed to export ${filePath}: ${error.message}`);
          skippedFiles++;
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Export Summary:');
  console.log(`   Total files found: ${totalFiles}`);
  console.log(`   Successfully exported: ${exportedFiles}`);
  console.log(`   Skipped/Failed: ${skippedFiles}`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));
  console.log('\n✅ Export complete!');
}

// Run export
exportToMarkdown();
