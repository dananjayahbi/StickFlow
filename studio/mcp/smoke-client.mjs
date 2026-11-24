import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['mcp/server.mjs'],
  cwd: process.cwd(),
  stderr: 'pipe',
});
const client = new Client({name: 'stickflow-smoke', version: '1.0.0'});
await client.connect(transport);
const listed = await client.listTools();
console.log(JSON.stringify({tools: listed.tools.map(tool => tool.name)}, null, 2));
const status = await client.callTool({name: 'stickflow_status', arguments: {}});
const payload = JSON.parse(status.content[0].text);
console.log(JSON.stringify({defaultEngine: payload.defaultEngine, projects: payload.counts.total, qwen: payload.engines.qwen.available}, null, 2));
await client.close();
