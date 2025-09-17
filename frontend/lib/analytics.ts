'use client'

interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  timestamp?: number
}

interface UserAction {
  action: 'token_created' | 'token_purchased' | 'token_sold' | 'wallet_connected' | 'wallet_disconnected'
  tokenAddress?: string
  amount?: string
  transactionHash?: string
  userAddress?: string
  metadata?: Record<string, any>
}

class Analytics {
  private events: AnalyticsEvent[] = []
  private isEnabled: boolean = false
  private sessionId: string = ''

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionId = this.generateSessionId()
      this.isEnabled = process.env.NODE_ENV === 'production'
      this.initializeAnalytics()
    }
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  private initializeAnalytics() {
    // Initialize analytics services (placeholder for real implementations)
    console.log('Analytics initialized', { sessionId: this.sessionId })

    // Track page views
    this.track('page_view', {
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer
    })
  }

  track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      },
      timestamp: Date.now()
    }

    this.events.push(analyticsEvent)

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', analyticsEvent)
    }

    // Send to analytics services
    if (this.isEnabled) {
      this.sendToServices(analyticsEvent)
    }

    // Limit stored events to last 100
    if (this.events.length > 100) {
      this.events = this.events.slice(-100)
    }
  }

  private sendToServices(event: AnalyticsEvent) {
    // TODO: Implement real analytics services

    // Example implementations:

    // Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event.event, event.properties)
    }

    // PostHog
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture(event.event, event.properties)
    }

    // Custom API endpoint
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(err => console.warn('Analytics API error:', err))
  }

  // Track specific user actions
  trackUserAction(action: UserAction) {
    this.track('user_action', {
      action: action.action,
      tokenAddress: action.tokenAddress,
      amount: action.amount,
      transactionHash: action.transactionHash,
      userAddress: action.userAddress ? action.userAddress.slice(0, 6) + '...' + action.userAddress.slice(-4) : undefined,
      ...action.metadata
    })
  }

  // Track performance metrics
  trackPerformance(metric: string, value: number, metadata?: Record<string, any>) {
    this.track('performance_metric', {
      metric,
      value,
      ...metadata
    })
  }

  // Track errors
  trackError(error: Error, context?: Record<string, any>) {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context
    })
  }

  // Track page navigation
  trackPageView(path?: string) {
    this.track('page_view', {
      path: path || (typeof window !== 'undefined' ? window.location.pathname : ''),
      url: typeof window !== 'undefined' ? window.location.href : ''
    })
  }

  // Get session data for debugging
  getSessionData() {
    return {
      sessionId: this.sessionId,
      eventCount: this.events.length,
      recentEvents: this.events.slice(-10)
    }
  }

  // Export events for analysis
  exportEvents() {
    return [...this.events]
  }
}

// Create singleton instance
const analytics = new Analytics()

export default analytics

// Convenience functions
export const trackEvent = (event: string, properties?: Record<string, any>) => {
  analytics.track(event, properties)
}

export const trackUserAction = (action: UserAction) => {
  analytics.trackUserAction(action)
}

export const trackPerformance = (metric: string, value: number, metadata?: Record<string, any>) => {
  analytics.trackPerformance(metric, value, metadata)
}

export const trackError = (error: Error, context?: Record<string, any>) => {
  analytics.trackError(error, context)
}

export const trackPageView = (path?: string) => {
  analytics.trackPageView(path)
}

// Hook for React components
export const useAnalytics = () => {
  return {
    track: trackEvent,
    trackUserAction,
    trackPerformance,
    trackError,
    trackPageView,
    getSessionData: () => analytics.getSessionData()
  }
}