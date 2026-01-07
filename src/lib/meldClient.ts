/**
 * Meld.io Fiat Payment Gateway Client
 *
 * Handles fiat-to-crypto payments through Meld.io
 * Users pay with FPX, cards, bank transfer → Merchant receives USDT on Solana network
 */

export interface MeldConfig {
  apiKey: string;
  secretKey: string;
  merchantId: string;
  environment: 'sandbox' | 'production' | 'demo';
}

export interface MeldPaymentRequest {
  amount: number; // Amount in USD/MYR
  currency: string; // USD, MYR, etc.
  cryptoCurrency: string; // USDT (on Solana network)
  destinationAddress: string; // Merchant USDT wallet address (Solana)
  customerEmail?: string;
  customerPhone?: string;
  orderId: string; // Your internal order/session ID
  returnUrl: string; // Where to redirect after payment
  webhookUrl: string; // Where Meld sends payment confirmations
}

export interface MeldPaymentResponse {
  success: boolean;
  paymentId: string; // Meld payment ID
  paymentUrl: string; // Redirect user here to complete payment
  status: 'pending' | 'processing' | 'completed' | 'failed';
  expiresAt: string;
  errors?: string[];
}

export interface MeldPaymentStatus {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  txHash?: string; // Blockchain transaction hash
  completedAt?: string;
  failureReason?: string;
}

export interface MeldWebhookPayload {
  event: 'payment.pending' | 'payment.processing' | 'payment.completed' | 'payment.failed';
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  status: string;
  txHash?: string;
  timestamp: string;
  signature: string; // For webhook verification
}

/**
 * Meld.io API Base URLs
 */
const MELD_API_URLS = {
  sandbox: 'https://api-sandbox.meld.io/v1',
  production: 'https://api.meld.io/v1',
  demo: 'https://api-sandbox.meld.io/v1', // Demo mode uses sandbox URL
};

/**
 * Get Meld configuration from environment variables
 */
function getMeldConfig(): MeldConfig {
  return {
    apiKey: process.env.MELD_API_KEY || '',
    secretKey: process.env.MELD_SECRET_KEY || '',
    merchantId: process.env.MELD_MERCHANT_ID || '',
    environment: (process.env.MELD_ENVIRONMENT as 'sandbox' | 'production' | 'demo') || 'sandbox',
  };
}

/**
 * Get Meld API base URL based on environment
 */
function getMeldApiUrl(): string {
  const config = getMeldConfig();
  return MELD_API_URLS[config.environment];
}

/**
 * Create a payment session with Meld.io
 *
 * @param request Payment request details
 * @returns Payment response with payment URL
 */
export async function createMeldPayment(
  request: MeldPaymentRequest
): Promise<MeldPaymentResponse> {
  const config = getMeldConfig();

  console.log('Meld config check:', {
    hasApiKey: !!config.apiKey,
    hasSecretKey: !!config.secretKey,
    hasMerchantId: !!config.merchantId,
    environment: config.environment,
  });

  // Demo/Test mode - if credentials are not configured or set to demo values
  const isDemoMode = !config.apiKey ||
                     !config.secretKey ||
                     config.apiKey === 'your_meld_api_key_here' ||
                     config.apiKey === 'demo' ||
                     config.environment === 'demo';

  if (isDemoMode) {
    console.log('⚠️ Running in DEMO mode - Meld credentials not configured');
    console.log('💡 To use real Meld payments, add credentials to .env.local');

    // Return mock payment response for testing
    const mockPaymentId = `DEMO-${Date.now()}`;
    return {
      success: true,
      paymentId: mockPaymentId,
      paymentUrl: `https://demo-checkout.meld.io/pay/${mockPaymentId}`, // Demo URL
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  try {
    const apiUrl = getMeldApiUrl();
    console.log('Meld API URL:', apiUrl);

    // Meld.io API request format
    // USDT SPL Token Mint Address on Solana: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
    const meldRequest = {
      merchantId: config.merchantId,
      orderId: request.orderId,
      sourceAmount: request.amount,
      sourceCurrencyCode: request.currency, // Fiat currency (USD, MYR)
      destinationCurrencyCode: request.cryptoCurrency, // USDT
      walletAddress: request.destinationAddress,
      customer: {
        email: request.customerEmail,
        phone: request.customerPhone,
      },
      returnUrl: request.returnUrl,
      webhookUrl: request.webhookUrl,
      expiresIn: 3600, // 1 hour expiry
    };

    console.log('📤 Meld API Request:', JSON.stringify(meldRequest, null, 2));

    const response = await fetch(`${apiUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-Secret-Key': config.secretKey,
      },
      body: JSON.stringify(meldRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Meld API Error:', response.status, errorData);
      throw new Error(`Meld API error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Meld API Response:', JSON.stringify(data, null, 2));

    return {
      success: true,
      paymentId: data.paymentId || data.id,
      paymentUrl: data.paymentUrl || data.checkoutUrl,
      status: data.status || 'pending',
      expiresAt: data.expiresAt,
    };

  } catch (error: any) {
    console.error('Error creating Meld payment:', error);

    return {
      success: false,
      paymentId: '',
      paymentUrl: '',
      status: 'failed',
      expiresAt: '',
      errors: [error.message || 'Failed to create Meld payment'],
    };
  }
}

/**
 * Get payment status from Meld.io
 *
 * @param paymentId Meld payment ID
 * @returns Payment status details
 */
export async function getMeldPaymentStatus(
  paymentId: string
): Promise<MeldPaymentStatus> {
  const config = getMeldConfig();
  const apiUrl = getMeldApiUrl();

  try {
    const response = await fetch(`${apiUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        'X-Secret-Key': config.secretKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Meld API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      paymentId: data.paymentId || data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      cryptoAmount: data.destinationCrypto?.amount || 0,
      cryptoCurrency: data.destinationCrypto?.currency || '',
      txHash: data.txHash || data.transactionHash,
      completedAt: data.completedAt,
      failureReason: data.failureReason,
    };

  } catch (error: any) {
    console.error('Error fetching Meld payment status:', error);
    throw error;
  }
}

/**
 * Verify Meld webhook signature
 *
 * @param payload Webhook payload
 * @param signature Signature from webhook headers
 * @returns True if signature is valid
 */
export function verifyMeldWebhook(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = process.env.MELD_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    console.error('MELD_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    // Implement HMAC signature verification
    // This is a placeholder - actual implementation depends on Meld's signature algorithm
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Get supported payment methods from Meld
 *
 * @param currency User's currency (USD, MYR, etc.)
 * @returns List of available payment methods
 */
export async function getMeldPaymentMethods(currency: string = 'USD') {
  const config = getMeldConfig();
  const apiUrl = getMeldApiUrl();

  try {
    const response = await fetch(`${apiUrl}/payment-methods?currency=${currency}`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Meld API error: ${response.status}`);
    }

    const data = await response.json();
    return data.paymentMethods || [];

  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
}
