import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { ShopifyCart, CartLineInput, ShopifyProduct } from '../types/shopify';
import { shopifyFetch, getCartId, setCartId, removeCartId, isShopifyConfigured, createCheckoutPermalink } from '../utils/shopify';
import {
  CREATE_CART,
  GET_CART,
  ADD_TO_CART,
  UPDATE_CART_LINES,
  REMOVE_FROM_CART,
} from '../graphql/queries';

interface CartContextType {
  cart: ShopifyCart | null;
  loading: boolean;
  error: string | null;
  addToCart: (lines: CartLineInput[]) => Promise<ShopifyCart>;
  updateCartLine: (lineId: string, quantity: number) => Promise<void>;
  removeFromCart: (lineIds: string[]) => Promise<void>;
  refreshCart: () => Promise<void>;
  addProductToCart: (variant: ShopifyProduct['variants']['nodes'][0], quantity: number) => Promise<void>;
  buyNow: (variant: ShopifyProduct['variants']['nodes'][0], quantity: number) => Promise<void>;
  addToCartLoading: boolean;
  buyNowLoading: boolean;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);

  const createCart = async (lines: CartLineInput[] = []) => {
    setLoading(true);
    setError(null);

    if (!isShopifyConfigured()) {
      const errorMessage = 'Shopify store is not configured';
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }

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

      const newCart = data.cartCreate.cart;
      setCart(newCart);
      setCartId(newCart.id);
      return newCart;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create cart';
      setError(errorMessage);
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cart';
      setError(errorMessage);
      removeCartId();
      setCart(null);
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
          currentCart = await createCart();
        }
      } else {
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

      const updatedCart = data.cartLinesAdd.cart;
      setCart(updatedCart);
      return updatedCart;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to cart';
      setError(errorMessage);
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

      const updatedCart = data.cartLinesUpdate.cart;
      setCart(updatedCart);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update cart';
      setError(errorMessage);
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

      const updatedCart = data.cartLinesRemove.cart;
      setCart(updatedCart);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from cart';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshCart = async () => {
    const cartId = getCartId();
    if (cartId) {
      try {
        await fetchCart(cartId);
      } catch {
        setCart(null);
      }
    }
  };

  const addProductToCart = async (variant: ShopifyProduct['variants']['nodes'][0], quantity: number) => {
    if (!variant.availableForSale) return;

    setAddToCartLoading(true);
    try {
      await addToCart([
        {
          merchandiseId: variant.id,
          quantity,
        },
      ]);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAddToCartLoading(false);
    }
  };

  const buyNow = async (variant: ShopifyProduct['variants']['nodes'][0], quantity: number) => {
    if (!variant.availableForSale) return;

    setBuyNowLoading(true);
    try {
      const checkoutUrl = createCheckoutPermalink(variant.id, quantity);
      
      const isInIframe = window.self !== window.top;
      
      if (isInIframe) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to create buy now link:', error);
    } finally {
      setBuyNowLoading(false);
    }
  };

  useEffect(() => {
    const initializeCart = async () => {
      const cartId = getCartId();
      if (cartId) {
        try {
          await fetchCart(cartId);
        } catch (error) {
          console.error('Failed to initialize cart:', error);
        }
      }
    };

    initializeCart();
  }, []);

  const value: CartContextType = {
    cart,
    loading,
    error,
    addToCart,
    updateCartLine,
    removeFromCart,
    refreshCart,
    addProductToCart,
    buyNow,
    addToCartLoading,
    buyNowLoading,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};