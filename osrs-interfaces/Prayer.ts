/**
 * OSRS Prayer Interface
 * Extracted from osrsbox-db prayers-complete.json
 * @see https://github.com/osrsbox/osrsbox-db
 */

export interface PrayerRequirements {
  /** Required Prayer level */
  prayer?: number

  /** Required Defence level (for some prayers like Chivalry, Piety) */
  defence?: number
}

export interface PrayerBonuses {
  /** Attack bonus percentage */
  attack?: number

  /** Defence bonus percentage */
  defence?: number

  /** Magic bonus percentage */
  magic?: number

  /** Ranged bonus percentage */
  ranged?: number

  /** Ranged strength bonus percentage */
  ranged_strength?: number

  /** Strength bonus percentage */
  strength?: number
}

export interface Prayer {
  /** Unique prayer ID */
  id: number

  /** Prayer name */
  name: string

  /** Whether the prayer is members-only */
  members: boolean

  /** Prayer description */
  description: string

  /** Prayer point drain rate per minute */
  drain_per_minute: number

  /** Wiki URL */
  wiki_url: string

  /** Skill requirements to unlock/use */
  requirements: PrayerRequirements

  /** Combat bonuses provided by the prayer */
  bonuses: PrayerBonuses

  /** Icon filename */
  icon: string
}
