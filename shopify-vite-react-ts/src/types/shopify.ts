export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  images: {
    nodes: Array<{
      id: string;
      url: string;
      altText: string | null;
      width: number;
      height: number;
    }>;
  };
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      price: {
        amount: string;
        currencyCode: string;
      };
      compareAtPrice: {
        amount: string;
        currencyCode: string;
      } | null;
      selectedOptions: Array<{
        name: string;
        value: string;
      }>;
      availableForSale: boolean;
    }>;
  };
  vendor: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface ShopifyCollection {
  id: string;
  title: string;
  description: string;
  handle: string;
  image: {
    url: string;
    altText: string | null;
  } | null;
  products: {
    nodes: ShopifyProduct[];
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  lines: {
    nodes: Array<{
      id: string;
      quantity: number;
      merchandise: {
        id: string;
        title: string;
        selectedOptions: Array<{
          name: string;
          value: string;
        }>;
        price: {
          amount: string;
          currencyCode: string;
        };
        product: {
          id: string;
          title: string;
          handle: string;
          featuredImage: {
            url: string;
            altText: string | null;
          } | null;
        };
      };
      cost: {
        totalAmount: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
}

export interface ShopifyGraphQLResponse<T> {
  data: T;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
}

export interface CartInput {
  lines: CartLineInput[];
}