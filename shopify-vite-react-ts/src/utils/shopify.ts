const SHOPIFY_STORE_URL = import.meta.env.VITE_SHOPIFY_STORE_URL;
const SHOPIFY_API_VERSION = import.meta.env.VITE_SHOPIFY_API_VERSION;

export const isShopifyConfigured = () => {
  return !!(SHOPIFY_STORE_URL && 
           SHOPIFY_API_VERSION && 
           SHOPIFY_STORE_URL !== 'fakestore-ai.myshopify.com');
};

export const SHOPIFY_STOREFRONT_API_URL = SHOPIFY_STORE_URL && SHOPIFY_API_VERSION 
  ? `https://${SHOPIFY_STORE_URL}/api/${SHOPIFY_API_VERSION}/graphql.json`
  : '';

export async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!isShopifyConfigured()) {
    throw new Error('Shopify store is not configured. Please set up your environment variables.');
  }

  const response = await fetch(SHOPIFY_STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

export const formatPrice = (price: { amount: string; currencyCode: string }) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currencyCode,
  }).format(parseFloat(price.amount));
};

export const getCartId = (): string | null => {
  return localStorage.getItem('shopify-cart-id');
};

export const setCartId = (cartId: string): void => {
  localStorage.setItem('shopify-cart-id', cartId);
};

export const removeCartId = (): void => {
  localStorage.removeItem('shopify-cart-id');
};

export const createCheckoutPermalink = (variantId: string, quantity: number = 1): string => {
  const numericVariantId = variantId.replace('gid://shopify/ProductVariant/', '');
  
  const checkoutUrl = `https://${SHOPIFY_STORE_URL}/cart/${numericVariantId}:${quantity}`;
  
  return checkoutUrl;
};

export const createMultiItemCheckoutPermalink = (items: Array<{ variantId: string; quantity: number }>): string => {
  const cartItems = items.map(item => {
    const numericVariantId = item.variantId.replace('gid://shopify/ProductVariant/', '');
    return `${numericVariantId}:${item.quantity}`;
  }).join(',');
  
  const checkoutUrl = `https://${SHOPIFY_STORE_URL}/cart/${cartItems}`;
  
  return checkoutUrl;
};