import type { FastifyInstance } from "fastify";
import type { World } from "@hyperforge/shared";
import { getDuelArenaOraclePublisher } from "../../oracle/DuelArenaOraclePublisher.js";

export function registerDuelOracleRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
  fastify.get<{
    Params: {
      duelId: string;
    };
  }>("/api/duel-arena/oracle/duels/:duelId", async (request, reply) => {
    const publisher = getDuelArenaOraclePublisher(world);
    if (!publisher) {
      return reply.code(404).send({
        error: "not_found",
        message: "Duel arena oracle publisher is not enabled",
      });
    }

    const record = publisher.getRecord(request.params.duelId);
    if (!record) {
      return reply.code(404).send({
        error: "not_found",
        message: `No oracle metadata found for duel ${request.params.duelId}`,
      });
    }

    return reply.send(record);
  });

  fastify.get("/api/duel-arena/oracle/recent", async (_request, reply) => {
    const publisher = getDuelArenaOraclePublisher(world);
    if (!publisher) {
      return reply.code(404).send({
        error: "not_found",
        message: "Duel arena oracle publisher is not enabled",
      });
    }

    return reply.send({
      records: publisher.getRecentRecords(50),
    });
  });
}
