/**
 * Bundles the application into a single standalone HTML file (standalone.html)
 * Allows opening and running directly in any browser (file:///) with ZERO server required!
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, 'index.html');
const cssPath = path.join(__dirname, 'css', 'styles.css');

const jsFiles = [
  'regex-parser.js',
  'nfa.js',
  'dfa.js',
  'minimizer.js',
  'simulator.js',
  'visualizer.js',
  'app.js'
];

let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// Replace CSS link with inline style
htmlContent = htmlContent.replace(
  '<link rel="stylesheet" href="css/styles.css">',
  `<style>\n${cssContent}\n</style>`
);

// Read JS modules and strip import/export statements for standalone inline script
let combinedJS = '';
for (const file of jsFiles) {
  const filePath = path.join(__dirname, 'js', file);
  let code = fs.readFileSync(filePath, 'utf-8');

  // Remove import statements
  code = code.replace(/import\s+[^;]+;?\n?/g, '');
  // Remove export keywords (export class -> class, export function -> function, export const -> const)
  code = code.replace(/export\s+(class|function|const|let|var)\s+/g, '$1 ');
  code = code.replace(/export\s+\{[^}]+\};?\n?/g, '');

  combinedJS += `\n/* --- Module: ${file} --- */\n` + code;
}

// Replace module script tag with inline script
htmlContent = htmlContent.replace(
  '<script type="module" src="js/app.js"></script>',
  `<script>\n${combinedJS}\n</script>`
);

const standalonePath = path.join(__dirname, 'standalone.html');
fs.writeFileSync(standalonePath, htmlContent, 'utf-8');

console.log('✅ standalone.html successfully generated! Can be opened directly with double-click in any browser.');
