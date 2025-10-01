'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/useWallet'
import { TokenCreator } from '@/components/TokenCreator'
import { TokenBoard } from '@/components/TokenBoard'
import { EnhancedTokenBoard } from '@/components/EnhancedTokenBoard'
import { WalletButton } from '@/components/WalletButton'
import { Sidebar } from '@/components/Sidebar'
import { AdminDashboard } from '@/components/AdminDashboard'
import { UserProfile } from '@/components/UserProfile'

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('home')
  const [showEnhancedUI, setShowEnhancedUI] = useState(true)
  const { isConnected, address } = useWallet()

  const renderMainContent = () => {
    switch (activeTab) {
      case 'home':
      case 'explore':
        return showEnhancedUI ? <EnhancedTokenBoard /> : <TokenBoard />
      case 'create':
        return <TokenCreator />
      case 'livestreams':
        return (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📺</div>
              <h2 className="text-2xl font-bold mb-4">Live Streaming Coming Soon</h2>
              <p className="text-gray-400 mb-8">
                Watch token creators live stream their launches, chat with the community, and see real-time trading action.
              </p>
              <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg max-w-md mx-auto">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-bold">LIVE FEATURE</span>
                </div>
                <div className="text-sm mt-1">Integration with streaming platforms in development</div>
              </div>
            </div>
          </div>
        )
      case 'advanced':
        return <AdminDashboard isAdmin={true} />
      case 'chat':
        return (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-bold mb-4">Community Chat</h2>
              <p className="text-gray-400 mb-8">
                Real-time chat with token creators and traders. Discuss strategies, share insights, and build community.
              </p>
              <div className="bg-green-500/20 border border-green-500/30 text-green-400 p-4 rounded-lg max-w-md mx-auto">
                <div className="flex items-center space-x-2">
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">NEW</span>
                  <span className="font-bold">CHAT ROOMS</span>
                </div>
                <div className="text-sm mt-1">Connect with the react.fun community</div>
              </div>
            </div>
          </div>
        )
      case 'profile':
        if (!isConnected || !address) {
          return (
            <div className="space-y-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👤</div>
                <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
                <p className="text-gray-400 mb-8">
                  Manage your tokens, track your portfolio, and view your creator rewards.
                </p>
                <div className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 p-4 rounded-lg max-w-md mx-auto">
                  <div className="font-bold">Connect Wallet</div>
                  <div className="text-sm mt-1">Connect your wallet to view your profile</div>
                </div>
              </div>
            </div>
          )
        }
        return <UserProfile address={address} isOwnProfile={true} />
      case 'support':
        return (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🛟</div>
              <h2 className="text-2xl font-bold mb-4">Support Center</h2>
              <p className="text-gray-400 mb-8">
                Get help with react.fun, learn about Somnia Network, and access developer resources.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="font-bold mb-2">📚 Documentation</h3>
                  <p className="text-gray-400 text-sm">Complete guides and API references</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="font-bold mb-2">💬 Discord</h3>
                  <p className="text-gray-400 text-sm">Join our community support</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="font-bold mb-2">🐛 GitHub</h3>
                  <p className="text-gray-400 text-sm">Report issues and contribute</p>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return showEnhancedUI ? <EnhancedTokenBoard /> : <TokenBoard />
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Mobile App Banner */}
              <div className="hidden lg:flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg px-4 py-2">
                <span className="text-sm">🚀 react.fun is better on mobile, faster trades, chat, and more.</span>
                <button className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg font-medium transition-colors">
                  Download now →
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* UI Toggle */}
              <button
                onClick={() => setShowEnhancedUI(!showEnhancedUI)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                {showEnhancedUI ? '📊 Enhanced' : '📋 Simple'}
              </button>

              {/* Action Buttons */}
              <button
                onClick={() => setActiveTab('create')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Create coin
              </button>

              <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                Log in
              </button>

              <WalletButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderMainContent()}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Built on Somnia Network - Ultra-fast EVM with 1M+ TPS, sub-cent fees
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="https://docs.react.fun" className="hover:text-white transition-colors">Docs</a>
              <a href="https://github.com/Blessedbiello/react.fun" className="hover:text-white transition-colors">GitHub</a>
              <a href="https://discord.gg/react" className="hover:text-white transition-colors">Discord</a>
              <a href="https://twitter.com/react_fun" className="hover:text-white transition-colors">Twitter</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}