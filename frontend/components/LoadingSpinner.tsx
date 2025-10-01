'use client'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-purple-500 ${sizeClasses[size]}`}></div>
      {text && (
        <span className={`text-gray-400 ${textSizeClasses[size]}`}>
          {text}
        </span>
      )}
    </div>
  )
}

export function LoadingCard() {
  return (
    <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded mb-2 w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-gray-700 rounded w-12"></div>
          <div className="h-3 bg-gray-700 rounded w-16"></div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 bg-gray-700 rounded w-20"></div>
            <div className="h-3 bg-gray-700 rounded w-24"></div>
          </div>
        ))}

        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-gray-600 h-2 rounded-full w-1/3"></div>
        </div>
      </div>

      <div className="h-10 bg-gray-700 rounded"></div>
    </div>
  )
}

export function FullPageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">react.fun</h2>
        <p className="text-gray-400">{text}</p>
      </div>
    </div>
  )
}