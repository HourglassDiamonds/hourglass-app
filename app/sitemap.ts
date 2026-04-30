import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://hourglassdiamonds.com/' },
    { url: 'https://hourglassdiamonds.com/the-house' },
    { url: 'https://hourglassdiamonds.com/engagement-rings' },
    { url: 'https://hourglassdiamonds.com/custom-design' },
    { url: 'https://hourglassdiamonds.com/diamond-guide' },
    { url: 'https://hourglassdiamonds.com/concierge' },
  ]
}