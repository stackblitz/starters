import { useState, useEffect } from 'react';
import { ShopifyProduct, ShopifyCart, CartLineInput, ShopifyCollection } from '../types/shopify';
import { shopifyFetch, getCartId, setCartId, removeCartId } from '../utils/shopify';
import {
  GET_PRODUCTS,
  GET_PRODUCT_BY_HANDLE,
  GET_COLLECTIONS,
  GET_COLLECTION_PRODUCTS,
  CREATE_CART,
  GET_CART,
  ADD_TO_CART,
  UPDATE_CART_LINES,
  REMOVE_FROM_CART,
} from '../graphql/queries';

export const useProducts = (query?: string) => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);

  const fetchProducts = async (reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{
        products: {
          nodes: ShopifyProduct[];
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string;
          };
        };
      }>(GET_PRODUCTS, {
        first: 20,
        after: reset ? null : endCursor,
        query,
      });

      setProducts(reset ? data.products.nodes : [...products, ...data.products.nodes]);
      setHasNextPage(data.products.pageInfo.hasNextPage);
      setEndCursor(data.products.pageInfo.endCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasNextPage) {
      fetchProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts(true);
  }, [query]);

  return {
    products,
    loading,
    error,
    hasNextPage,
    loadMore,
    refetch: () => fetchProducts(true),
  };
};

export const useProduct = (handle: string) => {
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await shopifyFetch<{ product: ShopifyProduct }>(
          GET_PRODUCT_BY_HANDLE,
          { handle }
        );
        setProduct(data.product);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    };

    if (handle) {
      fetchProduct();
    }
  }, [handle]);

  return { product, loading, error };
};

export const useCollections = () => {
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await shopifyFetch<{
          collections: {
            nodes: ShopifyCollection[];
          };
        }>(GET_COLLECTIONS, { first: 20 });
        
        setCollections(data.collections.nodes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch collections');
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  return { collections, loading, error };
};

export const useCollectionProducts = (handle: string) => {
  const [collection, setCollection] = useState<ShopifyCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollectionProducts = async (reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{
        collection: ShopifyCollection;
      }>(GET_COLLECTION_PRODUCTS, {
        handle,
        first: 20,
        after: null,
      });

      setCollection(data.collection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch collection products');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (handle) {
      fetchCollectionProducts(true);
    }
  }, [handle]);

  return {
    collection,
    loading,
    error,
    refetch: () => fetchCollectionProducts(true),
  };
};

export const useCart = () => {
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCart = async (lines: CartLineInput[] = []) => {
    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{
        cartCreate: {
          cart: ShopifyCart;
          userErrors: Array<{ field: string; message: string }>;
        };
      }>(CREATE_CART, {
        input: { lines },
      });

      if (data.cartCreate.userErrors.length > 0) {
        throw new Error(data.cartCreate.userErrors[0].message);
      }

      setCart(data.cartCreate.cart);
      setCartId(data.cartCreate.cart.id);
      return data.cartCreate.cart;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cart');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = async (cartId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{ cart: ShopifyCart }>(GET_CART, { id: cartId });
      setCart(data.cart);
      return data.cart;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cart');
      // If cart fetch fails, remove the invalid cart ID
      removeCartId();
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (lines: CartLineInput[]) => {
    let currentCart = cart;
    
    if (!currentCart) {
      const cartId = getCartId();
      if (cartId) {
        try {
          currentCart = await fetchCart(cartId);
        } catch {
          // If fetching existing cart fails, create a new one
          currentCart = await createCart();
        }
      } else {
        // No existing cart, create a new one
        currentCart = await createCart();
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{
        cartLinesAdd: {
          cart: ShopifyCart;
          userErrors: Array<{ field: string; message: string }>;
        };
      }>(ADD_TO_CART, {
        cartId: currentCart.id,
        lines,
      });

      if (data.cartLinesAdd.userErrors.length > 0) {
        throw new Error(data.cartLinesAdd.userErrors[0].message);
      }

      setCart(data.cartLinesAdd.cart);
      console.log('Cart updated successfully:', data.cartLinesAdd.cart);
      return data.cartLinesAdd.cart;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCartLine = async (lineId: string, quantity: number) => {
    if (!cart) return;

    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{
        cartLinesUpdate: {
          cart: ShopifyCart;
          userErrors: Array<{ field: string; message: string }>;
        };
      }>(UPDATE_CART_LINES, {
        cartId: cart.id,
        lines: [{ id: lineId, quantity }],
      });

      if (data.cartLinesUpdate.userErrors.length > 0) {
        throw new Error(data.cartLinesUpdate.userErrors[0].message);
      }

      setCart(data.cartLinesUpdate.cart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cart');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (lineIds: string[]) => {
    if (!cart) return;

    setLoading(true);
    setError(null);

    try {
      const data = await shopifyFetch<{
        cartLinesRemove: {
          cart: ShopifyCart;
          userErrors: Array<{ field: string; message: string }>;
        };
      }>(REMOVE_FROM_CART, {
        cartId: cart.id,
        lineIds,
      });

      if (data.cartLinesRemove.userErrors.length > 0) {
        throw new Error(data.cartLinesRemove.userErrors[0].message);
      }

      setCart(data.cartLinesRemove.cart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove from cart');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Initialize cart on mount
  useEffect(() => {
    const initializeCart = async () => {
      const cartId = getCartId();
      if (cartId) {
        try {
          await fetchCart(cartId);
        } catch {
          // Cart not found or invalid, will create new one when needed
        }
      }
    };

    initializeCart();
  }, []);

  return {
    cart,
    loading,
    error,
    addToCart,
    updateCartLine,
    removeFromCart,
    createCart,
    fetchCart,
  };
};