import { NextRequest, NextResponse } from 'next/server'
import { publicClient } from '@/lib/config'
import { CONTRACT_ADDRESSES } from '@/lib/config'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  version: string
  environment: string
  services: {
    blockchain: ServiceHealth
    contracts: ServiceHealth
    frontend: ServiceHealth
  }
  metrics: {
    responseTime: number
    uptime: number
  }
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastCheck: number
  error?: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: startTime,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      blockchain: await checkBlockchainHealth(),
      contracts: await checkContractsHealth(),
      frontend: checkFrontendHealth()
    },
    metrics: {
      responseTime: 0,
      uptime: process.uptime()
    }
  }

  // Calculate overall status
  const serviceStatuses = Object.values(healthCheck.services).map(s => s.status)
  if (serviceStatuses.includes('unhealthy')) {
    healthCheck.status = 'unhealthy'
  } else if (serviceStatuses.includes('degraded')) {
    healthCheck.status = 'degraded'
  }

  healthCheck.metrics.responseTime = Date.now() - startTime

  // Return appropriate status code
  const statusCode = healthCheck.status === 'healthy' ? 200 :
                    healthCheck.status === 'degraded' ? 200 : 503

  return NextResponse.json(healthCheck, { status: statusCode })
}

async function checkBlockchainHealth(): Promise<ServiceHealth> {
  const checkStart = Date.now()

  try {
    // Check if we can connect to the blockchain
    const blockNumber = await publicClient.getBlockNumber()
    const gasPrice = await publicClient.getGasPrice()

    const responseTime = Date.now() - checkStart

    // Check if network is responsive (< 5 seconds)
    if (responseTime > 5000) {
      return {
        status: 'degraded',
        responseTime,
        lastCheck: Date.now(),
        error: 'Network response time > 5 seconds'
      }
    }

    // Check if gas price is reasonable (< 100 Gwei)
    const gasPriceGwei = Number(gasPrice) / 1e9
    if (gasPriceGwei > 100) {
      return {
        status: 'degraded',
        responseTime,
        lastCheck: Date.now(),
        error: `High gas price: ${gasPriceGwei.toFixed(2)} Gwei`
      }
    }

    return {
      status: 'healthy',
      responseTime,
      lastCheck: Date.now()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - checkStart,
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Blockchain connection failed'
    }
  }
}

async function checkContractsHealth(): Promise<ServiceHealth> {
  const checkStart = Date.now()

  try {
    // Check if contracts are deployed
    if (CONTRACT_ADDRESSES.TOKEN_FACTORY === '0x0000000000000000000000000000000000000000') {
      return {
        status: 'degraded',
        responseTime: Date.now() - checkStart,
        lastCheck: Date.now(),
        error: 'Contracts not deployed'
      }
    }

    // Try to read from the contract
    const code = await publicClient.getBytecode({
      address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`
    })

    if (!code || code === '0x') {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - checkStart,
        lastCheck: Date.now(),
        error: 'Token factory contract not found'
      }
    }

    return {
      status: 'healthy',
      responseTime: Date.now() - checkStart,
      lastCheck: Date.now()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - checkStart,
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Contract health check failed'
    }
  }
}

function checkFrontendHealth(): ServiceHealth {
  // Basic frontend health checks
  const memoryUsage = process.memoryUsage()
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024

  // Check if memory usage is too high (> 512MB)
  if (memoryUsageMB > 512) {
    return {
      status: 'degraded',
      lastCheck: Date.now(),
      error: `High memory usage: ${memoryUsageMB.toFixed(2)}MB`
    }
  }

  // Check if uptime is reasonable
  const uptimeHours = process.uptime() / 3600
  if (uptimeHours > 24 * 7) { // Running for more than a week
    return {
      status: 'degraded',
      lastCheck: Date.now(),
      error: `Long uptime: ${uptimeHours.toFixed(1)} hours (consider restart)`
    }
  }

  return {
    status: 'healthy',
    lastCheck: Date.now()
  }
}

// Detailed health endpoint with more metrics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const includeMetrics = body.includeMetrics || false

    const detailedHealth = {
      ...(await GET(request)).json(),
      detailed: includeMetrics ? {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        },
        connections: {
          // Would track active WebSocket connections, database connections, etc.
        }
      } : undefined
    }

    return NextResponse.json(detailedHealth)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate detailed health check' },
      { status: 500 }
    )
  }
}