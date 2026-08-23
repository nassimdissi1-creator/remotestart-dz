export const PRICING = {
  talent_pro: { name: 'Pro / Featured Profile', amount: 29, customerType: 'talent' as const },
  ai_cv_review: { name: 'AI CV Review', amount: 12, customerType: 'talent' as const },
  job_standard: { name: 'Standard Job Post', amount: 199, customerType: 'employer' as const },
  job_featured: { name: 'Featured Job Post', amount: 299, customerType: 'employer' as const },
} as const

export type ProductCode = keyof typeof PRICING
export type PaymentMethod = 'redotpay' | 'baridimob'
