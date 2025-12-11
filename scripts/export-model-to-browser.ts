/**
 * Export Trained Model to Browser Storage
 * 
 * Provides instructions to load a model from the file system into browser IndexedDB.
 * Run with: npx tsx scripts/export-model-to-browser.ts
 * 
 * This allows trained models to be used in the Phaser game running in browser.
 */

import * as path from 'path';
import * as fs from 'fs';

const MODEL_DIR = './models';
const MODEL_NAME = 'musashi_v1';

function exportModelToBrowser() {
  console.log('🔄 Export trained model to browser storage\n');

  // Check if model exists
  const modelJsonPath = path.join(MODEL_DIR, MODEL_NAME, 'model.json');
  if (!fs.existsSync(modelJsonPath)) {
    console.error(`❌ Model not found at: ${modelJsonPath}`);
    console.error('   Train a model first with: npm run train\n');
    process.exit(1);
  }

  console.log(`✓ Found trained model at: ${modelJsonPath}\n`);

  // Read model.json to get architecture info
  const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8'));
  console.log(`Model Info:`);
  console.log(`  Format: ${modelJson.format || 'layers-model'}`);
  console.log(`  TensorFlow.js Version: ${modelJson.generatedBy || 'unknown'}`);
  console.log(`  Layers: ${modelJson.modelTopology?.config?.layers?.length || 'unknown'}\n`);

  const exportCode = `// Copy and paste this into your browser console when the game is running:

(async function() {
  try {
    // Load model from HTTP server
    const model = await tf.loadLayersModel('http://localhost:8080/musashi_v1/model.json');
    console.log('✓ Model loaded from HTTP');
    
    // Save to IndexedDB
    await model.save('indexeddb://musashi_v1');
    console.log('✓ Model saved to IndexedDB');
    console.log('  Reload the page - Neural Bot will now use trained model!');
  } catch (error) {
    console.error('❌ Export failed:', error);
  }
})();`;

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📋 EXPORT INSTRUCTIONS:\n');
  console.log('1. Start HTTP server for models (in a new terminal):');
  console.log('   npm run serve-models\n');
  console.log('2. Start the game (in another terminal):');
  console.log('   npm run dev\n');
  console.log('3. Open http://localhost:5173 in your browser\n');
  console.log('4. Open browser console (F12) and paste this code:\n');
  console.log(exportCode);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('After completing these steps, the trained model will load');
  console.log('automatically whenever you start the game!');
}

exportModelToBrowser();
