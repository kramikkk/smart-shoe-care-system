const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1'

if (!PAYMONGO_SECRET_KEY) {
  throw new Error('PAYMONGO_SECRET_KEY is not defined in environment variables')
}

// Base64 encode the secret key for Basic Auth
const authToken = Buffer.from(PAYMONGO_SECRET_KEY).toString('base64')

export class PayMongoClient {
  /**
   * Step 1: Create Payment Intent with QRPH enabled
   */
  async createPaymentIntent(amount: number, description: string) {
    console.log('Creating Payment Intent with QRPH')

    const response = await fetch(`${PAYMONGO_API_URL}/payment_intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amount * 100, // Convert to cents (₱50 = 5000 cents)
            payment_method_allowed: ['qrph'], // Enable QRPH
            currency: 'PHP',
            description: description,
            statement_descriptor: 'Smart Shoe Care',
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('PayMongo Create Payment Intent Error:', error)
      throw new Error(error.errors?.[0]?.detail || 'Failed to create payment intent')
    }

    const result = await response.json()
    console.log('Payment Intent Created:', {
      id: result.data.id,
      status: result.data.attributes.status
    })
    
    return result
  }

  /**
   * Step 2: Create QRPH Payment Method
   */
  async createPaymentMethod() {
    console.log('Creating QRPH Payment Method')

    const response = await fetch(`${PAYMONGO_API_URL}/payment_methods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            type: 'qrph',
            billing: {
              name: 'SSCM Customer',
              email: 'customer@sscm.com',
              phone: '00000000000' // Optional
            }
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('PayMongo Create Payment Method Error:', error)
      throw new Error(error.errors?.[0]?.detail || 'Failed to create payment method')
    }

    const result = await response.json()
    console.log('Payment Method Created:', result.data.id)
    
    return result
  }

  /**
   * Step 3: Attach Payment Method to Payment Intent
   */
  async attachPaymentMethod(paymentIntentId: string, paymentMethodId: string) {
    console.log('Attaching Payment Method to Payment Intent')

    const response = await fetch(
      `${PAYMONGO_API_URL}/payment_intents/${paymentIntentId}/attach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authToken}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId,
            }
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('PayMongo Attach Payment Method Error:', error)
      throw new Error(error.errors?.[0]?.detail || 'Failed to attach payment method')
    }

    const result = await response.json()
    
    // Extract QR code image URL from next_action
    const imageUrl = result.data.attributes.next_action?.code?.image_url
    
    console.log('Payment Method Attached:', {
      paymentIntentId: result.data.id,
      status: result.data.attributes.status,
      hasQRCode: !!imageUrl
    })
    
    return result
  }

  /**
   * Check Payment Status using Payment Intent ID
   */
  async getPaymentIntentStatus(paymentIntentId: string) {
    const response = await fetch(
      `${PAYMONGO_API_URL}/payment_intents/${paymentIntentId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.errors?.[0]?.detail || 'Failed to retrieve payment intent status')
    }

    return await response.json()
  }

  /**
   * Cancel/Void a Payment Intent
   * This prevents the QR code from being used after user cancels
   */
  async cancelPaymentIntent(paymentIntentId: string) {
    console.log('Cancelling Payment Intent:', paymentIntentId)

    const response = await fetch(
      `${PAYMONGO_API_URL}/payment_intents/${paymentIntentId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('PayMongo Cancel Payment Intent Error:', error)
      throw new Error(error.errors?.[0]?.detail || 'Failed to cancel payment intent')
    }

    const result = await response.json()
    console.log('Payment Intent Cancelled:', result.data.attributes.status)
    
    return result
  }
}