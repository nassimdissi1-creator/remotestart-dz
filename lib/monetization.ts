export const PRICING = {
  talent_pro: {
    name: 'Talent Pro Plus',
    amount: 29,
    baridimobAmount: 8000,
    baridimobCurrency: 'DZD',
    customerType: 'talent' as const,
    aiCvReviewsPerMonth: 5,
  },
  job_standard: {
    name: 'Standard Job Post',
    amount: 399,
    customerType: 'employer' as const,
  },
  job_featured: {
    name: 'Featured Job Post',
    amount: 499,
    customerType: 'employer' as const,
  },
} as const

export type ProductCode = keyof typeof PRICING
export type PaymentMethod = 'redotpay' | 'baridimob'
