/* L9_META
 * layer: api
 * role: seo_bot_engine
 * status: active
 */

import type { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { getDb, schema } from '../../core/database/index.js';
import { WebsiteFactoryContractV2 } from '../../../contracts/schema/website_factory_v2.js';

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505';
}

function buildClientConfig(payload: WebsiteFactoryContractV2) {
  return {
    targetKeywords: payload.targetKeywords.map((keywordEntry) => ({
      keyword: keywordEntry.keyword,
      priority: keywordEntry.priority,
    })),
    competitorUrls: payload.competitorUrls,
    vercelUrl: payload.vercelUrl,
    seo_contract: payload.seo_contract,
  };
}

const registerClientRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/clients/register', async (request, reply) => {
    const parsed = WebsiteFactoryContractV2.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        registered: false,
        error: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const normalizedDomain = payload.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    const db = getDb();

    try {
      const [client] = await db.insert(schema.clients).values({
        name: payload.name,
        domain: normalizedDomain,
        industry: payload.industry,
        city: payload.city ?? null,
        state: payload.state ?? null,
        posthogProjectId: payload.posthog_project_id ?? null,
        posthogApiKey: payload.posthog_api_key ?? null,
        config: buildClientConfig(payload),
      }).onConflictDoUpdate({
        target: schema.clients.domain,
        set: {
          config: buildClientConfig(payload),
          updatedAt: new Date(),
          active: true,
        },
      }).returning();

      return reply.status(201).send({
        registered: true,
        clientId: client.id,
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return reply.status(409).send({
          registered: false,
          error: `Client registration conflict for domain "${normalizedDomain}"`,
        });
      }

      throw error;
    }
  });
};

export default fastifyPlugin(registerClientRoutes);
