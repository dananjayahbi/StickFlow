/**
 * Shared read-only summaries for the CLI, dashboard and MCP server.
 */
import path from 'node:path';
import {engineHealth} from './config.mjs';
import {KOKORO_VOICES, QWEN_SPEAKERS} from './voices.mjs';
import {directorySize, listProjectDirs, sectionFolder, storageRelative} from './storage.mjs';
import {readProjectSummary} from './metadata.mjs';
import {describeVoice, listVoices} from './voices.mjs';

function encodePath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

export function mediaUrl(config, file) {
  if (!file) return null;
  const relative = storageRelative(config, file).split(path.sep).join('/');
  return `/api/media/${encodePath(relative)}`;
}

export function enrichProject(config, project) {
  const {dir, id, section, ...meta} = project;
  const prefix = `${sectionFolder(config, section)}/${id}`.split(path.sep).join('/');
  const asset = relative => relative ? `/api/media/${encodePath(`${prefix}/${String(relative).replace(/\\/g, '/')}`)}` : null;
  return {
    ...meta,
    id,
    section,
    dir,
    relativeDir: prefix,
    posterUrl: asset(meta.assets?.poster || meta.assets?.contactSheet),
    videoUrl: asset(meta.assets?.video),
    captionsUrl: asset(meta.assets?.captions),
    scriptUrl: asset(meta.assets?.script),
  };
}

export function collectProjects(config) {
  return listProjectDirs(config)
    .map(({dir, id, section}) => enrichProject(config, {...readProjectSummary(dir, config, section), dir, id, section}))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function projectCounts(projects) {
  const statuses = {};
  const sections = {};
  const engines = {};
  let durationSeconds = 0;
  let videoBytes = 0;
  let published = 0;
  let scheduled = 0;
  for (const project of projects) {
    statuses[project.status || 'draft'] = (statuses[project.status || 'draft'] || 0) + 1;
    sections[project.section || 'video'] = (sections[project.section || 'video'] || 0) + 1;
    const engine = project.tts?.engine || 'unknown';
    engines[engine] = (engines[engine] || 0) + 1;
    durationSeconds += Number(project.duration) || 0;
    videoBytes += Number(project.video?.bytes) || 0;
    if (project.status === 'published') published += 1;
    if (project.publish?.scheduledFor) scheduled += 1;
  }
  return {
    total: projects.length,
    statuses,
    sections,
    engines,
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    videoBytes,
    published,
    scheduled,
  };
}

export function buildStatus(config) {
  const projects = collectProjects(config);
  const counts = projectCounts(projects);
  const storageBytes = directorySize(config.paths.storageRoot);
  const voices = listVoices(config).map(describeVoice);
  return {
    root: config.paths.root,
    configFile: config.paths.configFile,
    dashboard: `http://${config.dashboard.host}:${config.dashboard.port}`,
    defaultEngine: config.tts.defaultEngine,
    fallbackToKokoro: config.tts.fallbackToKokoro,
    projectDefaults: config.projectDefaults,
    engines: engineHealth(config),
    storage: {
      root: config.paths.storageRoot,
      videos: path.join(config.paths.storageRoot, config.storage.sections.video),
      shorts: path.join(config.paths.storageRoot, config.storage.sections.short),
      library: config.paths.library,
      voices: config.paths.voices,
      bytes: storageBytes,
      videoBytes: counts.videoBytes,
    },
    counts,
    voices,
    recent: projects.slice(0, 6).map(project => ({
      id: project.id,
      title: project.title,
      status: project.status,
      section: project.section,
      style: project.style,
      duration: project.duration,
      posterUrl: project.posterUrl,
      videoUrl: project.videoUrl,
      updatedAt: project.updatedAt,
      tts: project.tts,
    })),
    projects,
  };
}

export function buildSettings(config) {
  return {
    tts: {
      defaultEngine: config.tts.defaultEngine,
      fallbackToKokoro: config.tts.fallbackToKokoro,
      qwen: {
        enabled: config.tts.engines.qwen.enabled,
        mode: config.tts.engines.qwen.mode,
        speaker: config.tts.engines.qwen.speaker,
        language: config.tts.engines.qwen.language,
        speed: config.tts.engines.qwen.speed,
        reference: config.tts.engines.qwen.reference,
      },
      kokoro: {
        enabled: config.tts.engines.kokoro.enabled,
        voice: config.tts.engines.kokoro.voice,
        speed: config.tts.engines.kokoro.speed,
      },
    },
    engines: engineHealth(config),
    voices: listVoices(config).map(describeVoice),
    speakers: QWEN_SPEAKERS,
    kokoroVoices: KOKORO_VOICES,
    configFile: config.paths.configFile,
  };
}

export function buildPlanner(config) {
  const projects = collectProjects(config);
  const scheduled = projects
    .filter(project => project.publish?.scheduledFor)
    .sort((a, b) => String(a.publish.scheduledFor).localeCompare(String(b.publish.scheduledFor)));
  const unscheduled = projects.filter(project => !project.publish?.scheduledFor);
  const published = projects.filter(project => project.status === 'published');
  return {
    timezone: config.publishing.timezone,
    platforms: config.publishing.platforms,
    counts: projectCounts(projects),
    scheduled,
    unscheduled,
    published,
  };
}
