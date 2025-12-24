export interface PaymentIntent {
  id: string
  type: string
  attributes: {
    amount: number
    currency: string
    description: string
    statement_descriptor: string
    status: 'awaiting_payment_method' | 'awaiting_next_action' | 'processing' | 'succeeded' | 'failed'
    client_key: string
    created_at: number
    updated_at: number
    payments: any[]
    next_action?: {
      type: string
      redirect?: {
        url: string
        return_url: string
      }
    }
  }
}

export interface PayMongoResponse<T> {
  data: T
}

export type PaymentStatus = 'awaiting_payment_method' | 'awaiting_next_action' | 'processing' | 'succeeded' | 'failed'