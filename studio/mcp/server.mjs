#!/usr/bin/env node
/**
 * StickFlow MCP server (stdio).
 *
 * Special Studio operations only:
 *   status, list/get projects, publish, planner, default TTS, reindex.
 *
 * Rendering and authoring are intentionally absent. The agent continues to use
 * `autopilot.mjs` and `tts.mjs` inside the project directory.
 */
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import * as tools from './tools.mjs';

const server = new McpServer({name: 'stickflow', version: '1.0.0'});

function text(value) {
  return {content: [{type: 'text', text: JSON.stringify(value, null, 2)}]};
}

function safe(fn) {
  return async args => {
    try {
      return text(await fn(args || {}));
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: error.message || String(error)}]};
    }
  };
}

server.registerTool('stickflow_status', {
  title: 'StickFlow status',
  description: 'Engine health, default voice, storage totals and recent projects.',
}, safe(() => tools.status()));

server.registerTool('stickflow_list_projects', {
  title: 'List StickFlow projects',
  description: 'List projects in Storage with optional section, status, style and text filters.',
  inputSchema: {
    section: z.enum(['video', 'short']).optional(),
    status: z.enum(['draft', 'preview', 'rendered', 'approved', 'published', 'archived']).optional(),
    style: z.string().optional(),
    query: z.string().optional(),
  },
}, safe(args => tools.listProjects(args)));

server.registerTool('stickflow_get_project', {
  title: 'Get StickFlow project',
  description: 'Read one project, its metadata and artifact inventory.',
  inputSchema: {
    project: z.string().describe('Project id, folder name, title fragment, or absolute path.'),
  },
}, safe(args => tools.getProject(args)));

server.registerTool('stickflow_publish_project', {
  title: 'Publish a StickFlow project to the dashboard',
  description: 'Register a rendered project in the gallery and set its publish metadata. This does not upload to YouTube or TikTok.',
  inputSchema: {
    project: z.string().describe('Project id, folder name, or absolute path.'),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    scheduledFor: z.string().nullable().optional().describe('ISO date/time, or null.'),
    externalUrl: z.string().nullable().optional(),
    status: z.enum(['draft', 'preview', 'rendered', 'approved', 'published', 'archived']).optional(),
    visibility: z.enum(['private', 'gallery']).optional(),
  },
}, safe(args => tools.publish(args)));

server.registerTool('stickflow_planner', {
  title: 'StickFlow publish planner',
  description: 'Read scheduled, unscheduled and published projects.',
}, safe(() => tools.planner()));

server.registerTool('stickflow_set_default_tts', {
  title: 'Set default StickFlow voice',
  description: 'Change the default TTS engine, Qwen preset/clone mode, speaker, or Kokoro voice.',
  inputSchema: {
    engine: z.enum(['qwen', 'kokoro']).optional(),
    qwenMode: z.enum(['custom_voice', 'clone']).optional(),
    speaker: z.string().optional(),
    kokoroVoice: z.string().optional(),
    fallbackToKokoro: z.boolean().optional(),
  },
}, safe(args => tools.setDefaultTts(args)));

server.registerTool('stickflow_reindex', {
  title: 'Reindex StickFlow projects',
  description: 'Refresh project-meta.json from project files, posters and render reports. Reindex one project or all.',
  inputSchema: {
    project: z.string().optional(),
  },
}, safe(args => tools.reindex(args)));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[stickflow-mcp] ready');
