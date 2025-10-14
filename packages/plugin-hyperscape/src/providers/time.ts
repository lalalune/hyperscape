import {
  type Provider,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core'

/**
 * Time Provider - Provides temporal context
 *
 * This provider offers timestamp information in various formats,
 * helping the agent understand when events occurred and provide
 * time-aware responses.
 */
export const timeProvider: Provider = {
  name: 'TIME',
  description:
    'Provides current time and date information in various formats for temporal context and time-aware responses.',

  get: async (_runtime: IAgentRuntime, _message: Memory, _state: State) => {
    logger.debug('[TIME_PROVIDER] Generating time context')

    try {
      const now = new Date()

      // Format various time representations
      const utcTime = now.toUTCString()
      const isoTime = now.toISOString()
      const localTime = now.toLocaleString()
      const timestamp = now.getTime()

      // Get individual components
      const year = now.getFullYear()
      const month = now.getMonth() + 1 // 0-indexed
      const day = now.getDate()
      const hour = now.getHours()
      const minute = now.getMinutes()
      const second = now.getSeconds()

      // Day of week and time of day
      const daysOfWeek = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ]
      const dayOfWeek = daysOfWeek[now.getDay()]

      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]
      const monthName = monthNames[now.getMonth()]

      // Determine time of day
      let timeOfDay = 'morning'
      if (hour >= 12 && hour < 17) {
        timeOfDay = 'afternoon'
      } else if (hour >= 17 && hour < 21) {
        timeOfDay = 'evening'
      } else if (hour >= 21 || hour < 6) {
        timeOfDay = 'night'
      }

      // Format for display
      const text = `# Current Time

## Formatted Times
- UTC: ${utcTime}
- ISO: ${isoTime}
- Local: ${localTime}
- Timestamp: ${timestamp}

## Date Components
- Year: ${year}
- Month: ${month} (${monthName})
- Day: ${day}
- Day of Week: ${dayOfWeek}

## Time Components
- Hour: ${hour}
- Minute: ${minute}
- Second: ${second}
- Time of Day: ${timeOfDay}

Use this information for:
- Greeting users appropriately ("Good ${timeOfDay}")
- Understanding temporal context
- Scheduling and time-based operations
- Timestamping events`

      logger.debug(`[TIME_PROVIDER] Current time: ${localTime}`)

      return {
        text,
        data: {
          utc: utcTime,
          iso: isoTime,
          local: localTime,
          timestamp,
          components: {
            year,
            month,
            day,
            hour,
            minute,
            second,
            dayOfWeek,
            monthName,
            timeOfDay,
          },
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[TIME_PROVIDER] Error generating time context:', errorMsg)
      return {
        text: 'Error retrieving time information.',
        data: {
          error: errorMsg,
        },
      }
    }
  },
}
