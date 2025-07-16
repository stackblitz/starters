import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ShopifyCart, CartLineInput } from '../types/shopify';
import { shopifyFetch, getCartId, setCartId, removeCartId } from '../utils/shopify';
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
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

      const newCart = data.cartCreate.cart;
      setCart(newCart);
      setCartId(newCart.id);
      console.log('Cart created successfully:', newCart);
      return newCart;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create cart';
      setError(errorMessage);
      console.error('Cart creation failed:', errorMessage);
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
      console.log('Cart fetched successfully:', data.cart);
      return data.cart;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cart';
      setError(errorMessage);
      console.error('Cart fetch failed:', errorMessage);
      // If cart fetch fails, remove the invalid cart ID
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

      const updatedCart = data.cartLinesAdd.cart;
      setCart(updatedCart);
      console.log('Item added to cart successfully:', updatedCart);
      return updatedCart;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to cart';
      setError(errorMessage);
      console.error('Add to cart failed:', errorMessage);
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
      console.log('Cart line updated successfully:', updatedCart);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update cart';
      setError(errorMessage);
      console.error('Cart update failed:', errorMessage);
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
      console.log('Items removed from cart successfully:', updatedCart);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from cart';
      setError(errorMessage);
      console.error('Remove from cart failed:', errorMessage);
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
        // Cart not found or invalid, clear it
        setCart(null);
      }
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
          console.log('No existing cart found, will create new one when needed');
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
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};