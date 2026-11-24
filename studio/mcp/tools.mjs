/**
 * Pure tool implementations for the StickFlow MCP server.
 *
 * These are intentionally limited to Studio operations: status, gallery,
 * publishing and voice settings. Rendering/authoring stays in the agent's
 * normal project-directory workflow.
 */
import path from 'node:path';
import {loadConfig, updateRawConfig} from '../lib/config.mjs';
import {findProject} from '../lib/storage.mjs';
import {artifactFiles, publishProject, readMeta, registerProject} from '../lib/metadata.mjs';
import {buildPlanner, buildStatus, collectProjects, enrichProject} from '../lib/summary.mjs';

function dashboardBase(config) {
  return `http://${config.dashboard.host}:${config.dashboard.port}`;
}

function projectUrl(config, id) {
  return `${dashboardBase(config)}/projects/${encodeURIComponent(id)}`;
}

function compactProject(project) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    visibility: project.visibility,
    section: project.section,
    format: project.format,
    style: project.style,
    duration: project.duration,
    tts: project.tts,
    tags: project.tags,
    publish: project.publish,
    posterUrl: project.posterUrl,
    videoUrl: project.videoUrl,
    updatedAt: project.updatedAt,
    dashboardUrl: project.dashboardUrl,
  };
}

export function status() {
  const config = loadConfig();
  const data = buildStatus(config);
  return {
    defaultEngine: data.defaultEngine,
    fallbackToKokoro: data.fallbackToKokoro,
    engines: data.engines,
    counts: data.counts,
    storage: data.storage,
    voices: data.voices,
    recent: data.recent,
    dashboard: dashboardBase(config),
    configFile: data.configFile,
  };
}

export function listProjects({section, status: statusFilter, style, query} = {}) {
  const config = loadConfig();
  let projects = collectProjects(config);
  if (section) projects = projects.filter(project => project.section === section);
  if (statusFilter) projects = projects.filter(project => project.status === statusFilter);
  if (style) projects = projects.filter(project => project.style === style);
  if (query) {
    const needle = query.toLowerCase();
    projects = projects.filter(project =>
      String(project.title || '').toLowerCase().includes(needle) ||
      String(project.description || '').toLowerCase().includes(needle) ||
      (project.tags || []).some(tag => String(tag).toLowerCase().includes(needle)));
  }
  return {
    count: projects.length,
    projects: projects.map(project => ({...compactProject(project), dashboardUrl: projectUrl(config, project.id)})),
  };
}

export function getProject({project}) {
  const config = loadConfig();
  const found = findProject(config, project);
  if (!found) throw new Error(`Project not found: ${project}`);
  const meta = readMeta(found.dir) ?? registerProject(found.dir, config, {id: found.id, section: found.section});
  const enriched = enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section});
  return {
    project: {...compactProject(enriched), dashboardUrl: projectUrl(config, found.id)},
    dir: found.dir,
    artifacts: Object.fromEntries(Object.entries(artifactFiles(found.dir)).map(([key, info]) => [key, info ? {
      path: path.relative(found.dir, info.path).split(path.sep).join('/'),
      bytes: info.bytes,
    } : null])),
  };
}

export function publish({project, title, description, tags, platforms, scheduledFor, externalUrl, status: nextStatus, visibility}) {
  const config = loadConfig();
  const found = findProject(config, project);
  if (!found) throw new Error(`Project not found: ${project}`);
  const meta = publishProject(found.dir, config, {
    title,
    description,
    tags,
    platforms,
    scheduledFor,
    externalUrl,
    status: nextStatus,
    visibility,
  });
  const enriched = enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section});
  return {
    published: true,
    project: compactProject(enriched),
    dashboardUrl: projectUrl(config, found.id),
    videoUrl: enriched.videoUrl ? `${dashboardBase(config)}${enriched.videoUrl}` : null,
  };
}

export function setDefaultTts({engine, qwenMode, speaker, kokoroVoice, fallbackToKokoro}) {
  const config = loadConfig();
  const raw = updateRawConfig(config => {
    if (engine) {
      if (!['qwen', 'kokoro'].includes(engine)) throw new Error('engine must be qwen or kokoro.');
      config.tts.defaultEngine = engine;
    }
    if (typeof fallbackToKokoro === 'boolean') config.tts.fallbackToKokoro = fallbackToKokoro;
    if (qwenMode) {
      if (!['custom_voice', 'clone'].includes(qwenMode)) throw new Error('qwenMode must be custom_voice or clone.');
      if (qwenMode === 'clone' && !config.tts.engines.qwen.reference.audio) {
        throw new Error('Clone mode needs a reference voice. Upload one in Dashboard → Settings first.');
      }
      config.tts.engines.qwen.mode = qwenMode;
    }
    if (speaker) config.tts.engines.qwen.speaker = speaker;
    if (kokoroVoice) config.tts.engines.kokoro.voice = kokoroVoice;
    return config;
  }, {file: config.paths.configFile});
  return {
    updated: true,
    defaultEngine: raw.tts.defaultEngine,
    fallbackToKokoro: raw.tts.fallbackToKokoro,
    qwen: {
      mode: raw.tts.engines.qwen.mode,
      speaker: raw.tts.engines.qwen.speaker,
      reference: raw.tts.engines.qwen.reference.voiceId,
    },
    kokoro: {voice: raw.tts.engines.kokoro.voice},
  };
}

export function reindex({project} = {}) {
  const config = loadConfig();
  if (project) {
    const found = findProject(config, project);
    if (!found) throw new Error(`Project not found: ${project}`);
    const meta = registerProject(found.dir, config, {id: found.id, section: found.section});
    return {updated: 1, projects: [{id: meta.id, title: meta.title, status: meta.status}]};
  }
  const projects = collectProjects(config).map(item => {
    const found = findProject(config, item.id);
    if (!found) return null;
    const meta = registerProject(found.dir, config, {id: found.id, section: found.section});
    return {id: meta.id, title: meta.title, status: meta.status};
  }).filter(Boolean);
  return {updated: projects.length, projects};
}

export function planner() {
  const config = loadConfig();
  const data = buildPlanner(config);
  return {
    ...data,
    scheduled: data.scheduled.map(project => ({...compactProject(project), dashboardUrl: projectUrl(config, project.id)})),
    unscheduled: data.unscheduled.map(project => ({...compactProject(project), dashboardUrl: projectUrl(config, project.id)})),
    published: data.published.map(project => ({...compactProject(project), dashboardUrl: projectUrl(config, project.id)})),
  };
}
