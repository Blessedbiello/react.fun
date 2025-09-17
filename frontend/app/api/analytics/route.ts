import { NextRequest, NextResponse } from 'next/server'

interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  timestamp: number
  sessionId?: string
  userAgent?: string
  ip?: string
}

// In production, you would store these in a database
// For now, we'll just log them and return success
const events: AnalyticsEvent[] = []

export async function POST(request: NextRequest) {
  try {
    const event: AnalyticsEvent = await request.json()

    // Add server-side metadata
    const enrichedEvent: AnalyticsEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      serverTimestamp: Date.now()
    }

    // Log the event (in production, save to database)
    console.log('📊 Analytics Event:', JSON.stringify(enrichedEvent, null, 2))

    // Store in memory (temporary - use database in production)
    events.push(enrichedEvent)

    // Keep only last 1000 events in memory
    if (events.length > 1000) {
      events.splice(0, events.length - 1000)
    }

    // In production, you would:
    // 1. Validate the event schema
    // 2. Store in a time-series database (InfluxDB, TimescaleDB)
    // 3. Send to external analytics services (Google Analytics, Mixpanel, etc.)
    // 4. Process for real-time dashboards
    // 5. Apply rate limiting per IP/user

    return NextResponse.json({
      success: true,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: enrichedEvent.serverTimestamp
    })

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to process analytics event' },
      { status: 400 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const timeframe = searchParams.get('timeframe') || '1h'
  const eventType = searchParams.get('event')
  const limit = parseInt(searchParams.get('limit') || '100')

  try {
    // Calculate time range
    const now = Date.now()
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }

    const timeRange = timeRanges[timeframe as keyof typeof timeRanges] || timeRanges['1h']
    const startTime = now - timeRange

    // Filter events
    let filteredEvents = events.filter(event =>
      event.timestamp >= startTime &&
      (!eventType || event.event === eventType)
    )

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp - a.timestamp)

    // Limit results
    filteredEvents = filteredEvents.slice(0, limit)

    // Generate summary statistics
    const summary = generateSummary(filteredEvents, startTime, now)

    return NextResponse.json({
      timeframe,
      eventType,
      totalEvents: filteredEvents.length,
      events: filteredEvents,
      summary
    })

  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve analytics data' },
      { status: 500 }
    )
  }
}

function generateSummary(events: AnalyticsEvent[], startTime: number, endTime: number) {
  const eventCounts: Record<string, number> = {}
  const userActions: Record<string, number> = {}
  const performanceMetrics: Array<{ metric: string, value: number, timestamp: number }> = []
  const errorCounts: Record<string, number> = {}

  events.forEach(event => {
    // Count events by type
    eventCounts[event.event] = (eventCounts[event.event] || 0) + 1

    // Count user actions
    if (event.event === 'user_action' && event.properties?.action) {
      const action = event.properties.action
      userActions[action] = (userActions[action] || 0) + 1
    }

    // Collect performance metrics
    if (event.event === 'performance_metric' && event.properties?.metric && event.properties?.value) {
      performanceMetrics.push({
        metric: event.properties.metric,
        value: event.properties.value,
        timestamp: event.timestamp
      })
    }

    // Count errors
    if (event.event === 'error' && event.properties?.message) {
      const errorType = event.properties.name || 'Unknown'
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1
    }
  })

  // Calculate average performance metrics
  const avgPerformance: Record<string, { avg: number, min: number, max: number, count: number }> = {}

  performanceMetrics.forEach(metric => {
    if (!avgPerformance[metric.metric]) {
      avgPerformance[metric.metric] = { avg: 0, min: metric.value, max: metric.value, count: 0 }
    }

    const current = avgPerformance[metric.metric]
    current.min = Math.min(current.min, metric.value)
    current.max = Math.max(current.max, metric.value)
    current.avg = (current.avg * current.count + metric.value) / (current.count + 1)
    current.count += 1
  })

  return {
    timeRange: {
      start: startTime,
      end: endTime,
      duration: endTime - startTime
    },
    events: {
      total: events.length,
      byType: eventCounts
    },
    userActions: {
      total: Object.values(userActions).reduce((sum, count) => sum + count, 0),
      byAction: userActions
    },
    performance: avgPerformance,
    errors: {
      total: Object.values(errorCounts).reduce((sum, count) => sum + count, 0),
      byType: errorCounts
    },
    topEvents: Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }))
  }
}

function getClientIP(request: NextRequest): string {
  // Try various headers for getting client IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const clientIP = request.headers.get('x-client-ip')

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (clientIP) {
    return clientIP
  }

  // Fallback to a placeholder IP
  return '127.0.0.1'
}