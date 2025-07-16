const SHOPIFY_STORE_URL = import.meta.env.VITE_SHOPIFY_STORE_URL;
const SHOPIFY_API_VERSION = import.meta.env.VITE_SHOPIFY_API_VERSION;

if (!SHOPIFY_STORE_URL) {
  throw new Error('VITE_SHOPIFY_STORE_URL environment variable is required');
}

if (!SHOPIFY_API_VERSION) {
  throw new Error('VITE_SHOPIFY_API_VERSION environment variable is required');
}

export const SHOPIFY_STOREFRONT_API_URL = `https://${SHOPIFY_STORE_URL}/api/${SHOPIFY_API_VERSION}/graphql.json`;

export async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  console.log('Making Shopify API request to:', SHOPIFY_STOREFRONT_API_URL);
  
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
    console.error('HTTP error:', response.status, response.statusText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  console.log('Shopify API response:', json);

  if (json.errors) {
    console.error('GraphQL errors:', json.errors);
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
  // Remove the 'gid://shopify/ProductVariant/' prefix from the variant ID
  const numericVariantId = variantId.replace('gid://shopify/ProductVariant/', '');
  
  // Create the checkout permalink URL
  const checkoutUrl = `https://${SHOPIFY_STORE_URL}/cart/${numericVariantId}:${quantity}`;
  
  console.log('Generated checkout permalink:', checkoutUrl);
  return checkoutUrl;
};

export const createMultiItemCheckoutPermalink = (items: Array<{ variantId: string; quantity: number }>): string => {
  // Convert each item to the format "variantId:quantity"
  const cartItems = items.map(item => {
    const numericVariantId = item.variantId.replace('gid://shopify/ProductVariant/', '');
    return `${numericVariantId}:${item.quantity}`;
  }).join(',');
  
  // Create the checkout permalink URL
  const checkoutUrl = `https://${SHOPIFY_STORE_URL}/cart/${cartItems}`;
  
  console.log('Generated multi-item checkout permalink:', checkoutUrl);
  return checkoutUrl;
};