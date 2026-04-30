/**
 * World Project Templates route
 *
 * Phase B0'.B of `PLAN_PROJECT_AS_DATA.md`. `GET /api/world/project-templates`
 * returns the list of available templates (currently `blank` and
 * `hyperia`) so the editor's New-Project picker can render them.
 *
 * Public: template metadata is non-sensitive (name, description,
 * plugin set). Cloning a template into an actual project still
 * requires auth + `project:create` permission, which is enforced
 * on `POST /api/world/projects` in `world-projects.ts`.
 */

import { Elysia } from "elysia";
import { ProjectTemplateService } from "../services/ProjectTemplateService";
import * as WS from "../models/world-studio.models";

export const createWorldProjectTemplatesRoute = (
  templateService: ProjectTemplateService,
) => {
  return new Elysia({
    prefix: "/api/world/project-templates",
    name: "world-project-templates-routes",
  }).get(
    "/",
    () => {
      return templateService.list().map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        thumbnailUrl: t.thumbnailUrl,
        defaultPick: t.defaultPick,
        plugins: [...t.seed.plugins],
      }));
    },
    {
      response: {
        200: WS.ProjectTemplateListResponse,
      },
      detail: {
        tags: ["World Projects"],
        summary: "List available project templates",
      },
    },
  );
};
