// Simple test to verify script execution
import { executeScriptAsync } from './src/script-executor.js';

const code = `
const x = 10;
const y = 20;
return x + y;
`;

const context = {
  variables: {},
  inputs: {},
};

const result = await executeScriptAsync(code, context, { timeout: 5000 });
console.log('Result:', JSON.stringify(result, null, 2));
