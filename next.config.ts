import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/scorecard',
        destination: '/scorecard.html',
      },
      {
        source: '/api/yf-chart/:symbol*',
        destination: 'https://query1.finance.yahoo.com/v8/finance/chart/:symbol*',
      },
      {
        source: '/api/yf-quote/:symbol*',
        destination: 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/:symbol*',
      },
    ]
  },
}

export default nextConfig
