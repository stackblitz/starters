import React from 'react';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCartContext } from '../hooks/useCartContext';
import { formatPrice } from '../utils/shopify';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { cart, loading, updateCartLine, removeFromCart } = useCartContext();

  const handleQuantityChange = async (lineId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeFromCart([lineId]);
    } else {
      await updateCartLine(lineId, newQuantity);
    }
  };

const handleCheckout = () => {
  if (cart?.checkoutUrl) {
    const isInIframe = window.self !== window.top;
    
    if (isInIframe) {
      window.open(cart.checkoutUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = cart.checkoutUrl;
    }
  } else {
    console.error('No checkout URL available');
  }
};

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Shopping Cart</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!cart || cart.lines.nodes.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 mb-2">Your cart is empty</p>
              <p className="text-sm text-gray-500">Add some products to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.lines.nodes.map((line) => (
                <div key={line.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-md overflow-hidden">
                    {line.merchandise.product.featuredImage ? (
                      <img
                        src={line.merchandise.product.featuredImage.url}
                        alt={line.merchandise.product.featuredImage.altText || line.merchandise.product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {line.merchandise.product.title}
                    </h4>
                    {line.merchandise.selectedOptions.map((option) => (
                      <p key={option.name} className="text-xs text-gray-500">
                        {option.name}: {option.value}
                      </p>
                    ))}
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {formatPrice(line.merchandise.price)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleQuantityChange(line.id, line.quantity - 1)}
                      disabled={loading}
                      className="p-1 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {line.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(line.id, line.quantity + 1)}
                      disabled={loading}
                      className="p-1 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart([line.id])}
                    disabled={loading}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart && cart.lines.nodes.length > 0 && (
          <div className="border-t p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Subtotal</span>
              <span className="text-lg font-bold">
                {formatPrice(cart.cost.subtotalAmount)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Total items</span>
              <span>{cart.totalQuantity}</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Checkout'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Shipping and taxes calculated at checkout
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;