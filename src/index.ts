/* L9_META
 * layer: module
 * role: seo_bot_engine
 * status: active
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * L9 SEO Bot - Main Entry Point
 * Version: 1.0.0
 *
 * Autonomous, multi-tenant SEO optimization engine.
 * Runs 24/7 on Hetzner CX32 via Docker Compose.
 *
 * Architecture:
 * - BullMQ scheduler dispatches cron jobs
 * - 5 modules execute independently
 * - LLM invoked surgically (95% pure code, 5% AI judgment)
 * - PostHog integration for behavior intelligence
 * - Operator notifications via Email + Telegram
 * - HTTP API served exclusively via Fastify (src/api/index.ts)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { loadConfig } from './core/config.js';
import { createModuleLogger } from './core/logger.js';
import { closeDb } from './core/database/index.js';
import { getScheduler } from './core/scheduler.js';
import { startApiServer } from './api/index.js';

// Module imports
import { registerSerpHandlers } from './modules/serp-intelligence/index.js';
import { registerVitalsHandlers } from './modules/web-vitals/index.js';
import { registerAeoHandlers } from './modules/aeo-geo/index.js';
import { registerLinkHandlers } from './modules/link-building/index.js';
import { registerBehaviorHandlers } from './modules/behavior-intelligence/index.js';

const logger = createModuleLogger('main');

async function main() {
  // ─── Load & Validate Config ──────────────────────────────────────────────
  const config = loadConfig();
  logger.info('Configuration validated');

  // ─── Initialize Scheduler ────────────────────────────────────────────────
  const scheduler = getScheduler();

  // Register all module handlers
  registerSerpHandlers(scheduler);
  registerVitalsHandlers(scheduler);
  registerAeoHandlers(scheduler);
  registerLinkHandlers(scheduler);
  registerBehaviorHandlers(scheduler);

  await scheduler.start();
  logger.info('All modules registered and scheduler started');

  // ─── HTTP API — exclusively Fastify (src/api/index.ts) ───────────────────
  // Express server removed (T2.2). All routes live in src/api/index.ts.
  // Routes served: /health, /api/clients, /api/clients/:id, /api/clients/:id/report,
  //                /api/clients/:id/trigger, /api/status, /api/llm-spend, /api/token-budget
  await startApiServer(config.BOT_PORT);

  // ─── Graceful Shutdown ───────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await scheduler.stop();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('  L9 SEO Bot v1.0.0 - OPERATIONAL');
  logger.info('  Modules: SERP | Vitals | AEO/GEO | Links | Behavior');
  logger.info('  API: Fastify on port ' + config.BOT_PORT);
  logger.info('═══════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
