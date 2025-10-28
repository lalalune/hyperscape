/**
 * validation-schemas.ts - Strict Zod schemas for type validation
 *
 * CLAUDE.md Compliance: Use strict type validation instead of loose any/unknown types
 */

import { z } from "zod";

// Vector3 schema
export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Quaternion schema
export const QuaternionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});

// Component schema (from Hyperscape)
export const ComponentSchema = z.object({
  type: z.string(),
  data: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// Metadata schema - only allow primitive types
export const MetadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()]),
);

// Entity creation data schema
export const EntityCreationDataSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1).optional(),
  position: Vector3Schema.optional(),
  rotation: QuaternionSchema.optional(),
  scale: Vector3Schema.optional(),
  components: z.array(ComponentSchema).optional(),
  metadata: MetadataSchema.optional(),
});

// Entity update data schema
export const EntityUpdateDataSchema = z.object({
  position: Vector3Schema.optional(),
  rotation: QuaternionSchema.optional(),
  scale: Vector3Schema.optional(),
  name: z.string().min(1).optional(),
  metadata: MetadataSchema.optional(),
});

// Visual config schemas
export const EntityColorConfigSchema = z.object({
  color: z.union([
    z.number().int().min(0).max(0xffffff),
    z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ]),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  tolerance: z.number().min(0).max(1).optional(),
});

export const UIThemeSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  fonts: z.record(z.string().min(1)).optional(),
});

export const VisualConfigSchema = z.object({
  entityColors: z.record(EntityColorConfigSchema).optional(),
  uiTheme: UIThemeSchema.optional(),
  assets: z
    .object({
      models: z.array(z.string().min(1)).optional(),
    })
    .optional(),
});

// Response content schema
export const ResponseContentSchema = z
  .object({
    text: z.string().optional(),
    action: z.string().optional(),
    coordinates: z.string().optional(),
    message: z.string().optional(),
    // Allow additional properties but they must be primitives
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

// Player and system schemas
export const PlayerEffectSchema = z.object({
  emote: z.string().nullable().optional(),
});

export const PlayerDataSchema = z
  .object({
    effect: PlayerEffectSchema.optional(),
    avatarUrl: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

// Action schemas
export const ActionContextSchema = z.object({
  entity: z
    .object({
      root: z
        .object({
          position: Vector3Schema.optional(),
        })
        .optional(),
      data: z
        .object({
          id: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const ActionNodeSchema = z.object({
  label: z.string().optional(),
  ctx: ActionContextSchema.optional(),
});

// Service and system event schemas
export const EventDataSchema = z.record(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]),
);

export const EventListenerSchema = z
  .function()
  .args(EventDataSchema)
  .returns(z.void());

export const EntityDataSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    position: z.tuple([z.number(), z.number(), z.number()]).optional(),
    active: z.boolean().optional(),
    visible: z.boolean().optional(),
    name: z.string().min(1).optional(),
  })
  .catchall(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.number())]),
  );

export const EntityUpdateSchema = z
  .object({
    id: z.string().optional(),
    position: z.tuple([z.number(), z.number(), z.number()]).optional(),
    rotation: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .optional(),
    velocity: z.tuple([z.number(), z.number(), z.number()]).optional(),
    data: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export const PlayerAppearanceSchema = z
  .object({
    avatar: z.string().url().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    scale: z.number().positive().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export const PlayerDataExtendedSchema = PlayerDataSchema.extend({
  appearance: PlayerAppearanceSchema.optional(),
  inventory: z
    .object({
      items: z
        .array(
          z.object({
            itemId: z.string().min(1),
            itemName: z.string().min(1).optional(),
            quantity: z.number().int().min(0).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
}).catchall(z.union([z.string(), z.number(), z.boolean()]));

export const ControllerInterfaceSchema = z.object({
  walkToward: z
    .function()
    .args(Vector3Schema, z.number())
    .returns(Vector3Schema)
    .optional(),
  move: z.function().args(Vector3Schema).returns(z.void()).optional(),
  position: Vector3Schema.optional(),
  velocity: Vector3Schema.optional(),
});

export const ChatMessageDataSchema = z
  .object({
    sender: z.string().min(1),
    text: z.string().min(1),
    timestamp: z.number().int().positive().optional(),
    type: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export const NetworkPacketSchema = z.object({
  type: z.string().min(1),
  data: z.record(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.number())]),
  ),
  timestamp: z.number().int().positive().optional(),
});

// Type exports inferred from schemas
export type EntityCreationData = z.infer<typeof EntityCreationDataSchema>;
export type EntityUpdateData = z.infer<typeof EntityUpdateDataSchema>;
export type VisualConfig = z.infer<typeof VisualConfigSchema>;
export type ResponseContent = z.infer<typeof ResponseContentSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type PlayerEffect = z.infer<typeof PlayerEffectSchema>;
export type PlayerData = z.infer<typeof PlayerDataSchema>;
export type ActionNode = z.infer<typeof ActionNodeSchema>;
export type EventData = z.infer<typeof EventDataSchema>;
export type EventListener = z.infer<typeof EventListenerSchema>;
export type EntityData = z.infer<typeof EntityDataSchema>;
export type EntityUpdate = z.infer<typeof EntityUpdateSchema>;
export type PlayerAppearance = z.infer<typeof PlayerAppearanceSchema>;
export type PlayerDataExtended = z.infer<typeof PlayerDataExtendedSchema>;
export type ControllerInterface = z.infer<typeof ControllerInterfaceSchema>;
export type ChatMessageData = z.infer<typeof ChatMessageDataSchema>;
export type NetworkPacket = z.infer<typeof NetworkPacketSchema>;
