'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/useWallet'
import { useAnalytics } from '@/lib/analytics'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { address, isConnected } = useWallet()
  const { track } = useAnalytics()
  const [creatorRewards, setCreatorRewards] = useState('$12.47')
  const [showQRCode, setShowQRCode] = useState(false)

  const menuItems = [
    {
      id: 'home',
      name: 'Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'livestreams',
      name: 'Livestreams',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      badge: 'LIVE'
    },
    {
      id: 'advanced',
      name: 'Advanced',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'chat',
      name: 'Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.13 8.13 0 01-2.548-.403l-4.7 1.175a.996.996 0 01-1.217-1.217l1.175-4.7A7.961 7.961 0 014 12C4 7.582 7.582 4 12 4s8 3.582 8 8z" />
        </svg>
      ),
      badge: 'NEW'
    },
    {
      id: 'profile',
      name: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'support',
      name: 'Support',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a.75.75 0 000 1.5v8.5a.75.75 0 000 1.5M12 21a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      )
    },
    {
      id: 'more',
      name: 'More',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      )
    }
  ]

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId)
    track('sidebar_navigation', {
      tab: tabId,
      from: activeTab
    })
  }

  return (
    <div className="bg-gray-900 w-64 min-h-screen flex flex-col border-r border-gray-800">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            react.fun
          </h1>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-4">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors group ${
                  activeTab === item.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className={`${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.name}</span>
                {item.badge && (
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                    item.badge === 'LIVE'
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Creator Rewards Section */}
      {isConnected && (
        <div className="p-6 border-t border-gray-800">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">my creator rewards</span>
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                new
              </span>
            </div>
            <div className="text-2xl font-bold text-white">{creatorRewards}</div>
            <div className="text-xs text-gray-400 mt-1">
              From {Math.floor(Math.random() * 20) + 5} token launches
            </div>
          </div>

          {/* Holdings */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">holdings</span>
              <span className="text-xs text-gray-500">23</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">react.fun tokens</span>
                <span className="text-white">328</span>
              </div>
              <div className="text-xs text-gray-500">3.5M PBTS</div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile App Section */}
      <div className="p-6 border-t border-gray-800">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold text-white mb-2">react.fun app</h3>

          {/* QR Code */}
          <div className="bg-white p-3 rounded-lg mb-3 flex items-center justify-center">
            <div className="w-20 h-20 bg-black rounded grid grid-cols-8 gap-px">
              {/* Mock QR code pattern */}
              {Array.from({ length: 64 }, (_, i) => (
                <div
                  key={i}
                  className={`${
                    Math.random() > 0.5 ? 'bg-black' : 'bg-white'
                  } aspect-square`}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mb-3">
            Scan to download
          </p>

          <button
            onClick={() => setShowQRCode(!showQRCode)}
            className="w-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Learn more
          </button>
        </div>
      </div>

      {/* Create Coin Button */}
      <div className="p-6 border-t border-gray-800">
        <button
          onClick={() => handleTabClick('create')}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-105"
        >
          Create coin
        </button>
      </div>

      {/* Quick Stats */}
      <div className="p-6 border-t border-gray-800">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Network:</span>
            <span className="text-green-400 font-medium">Somnia</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">TPS:</span>
            <span className="text-blue-400 font-medium">1M+</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Avg Fee:</span>
            <span className="text-yellow-400 font-medium">&lt;$0.01</span>
          </div>
        </div>
      </div>
    </div>
  )
}