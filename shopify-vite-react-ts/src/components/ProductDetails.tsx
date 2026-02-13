import React, { useState } from 'react';
import { ShoppingCart, Zap } from 'lucide-react';
import { formatPrice } from '../utils/shopify';
import QuantitySelector from './QuantitySelector';
import { ShopifyProduct } from '../types/shopify';
import { useCartContext } from '../hooks/useCartContext';

type ProductVariant = ShopifyProduct['variants']['nodes'][0];

interface ProductDetailsProps {
  vendor?: string;
  title: string;
  description?: string;
  variants: ProductVariant[];
  selectedVariant: number;
  onVariantChange: (index: number) => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({
  vendor,
  title,
  description,
  variants,
  selectedVariant,
  onVariantChange,
}) => {
  const [quantity, setQuantity] = useState(1);
  const { addProductToCart, buyNow, addToCartLoading, buyNowLoading } = useCartContext();
  
  const currentVariant = variants[selectedVariant];
  const isProductAvailable = currentVariant?.availableForSale;
  const isOnSale = currentVariant?.compareAtPrice && 
    parseFloat(currentVariant.compareAtPrice.amount) > parseFloat(currentVariant.price.amount);

  const handleAddToCart = () => {
    if (currentVariant && isProductAvailable) {
      addProductToCart(currentVariant, quantity);
    }
  };

  const handleBuyNow = () => {
    if (currentVariant && isProductAvailable) {
      buyNow(currentVariant, quantity);
    }
  };

  return (
    <div className="space-y-6">
      {vendor && (
        <p className="text-sm text-blue-600 font-medium">{vendor}</p>
      )}

      <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
        {title}
      </h1>

      <div className="space-y-2">
        <div className="flex items-center space-x-3">
          <span className="text-3xl font-bold text-gray-900">
            {formatPrice(currentVariant.price)}
          </span>
          {isOnSale && currentVariant.compareAtPrice && (
            <span className="text-xl text-gray-500 line-through">
              {formatPrice(currentVariant.compareAtPrice)}
            </span>
          )}
          {isOnSale && (
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-sm font-medium">
              Sale
            </span>
          )}
        </div>
        {!isProductAvailable && (
          <p className="text-red-600 font-medium">Out of Stock</p>
        )}
      </div>

      {description && (
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-600">{description}</p>
        </div>
      )}

      {variants.length > 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Options</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {variants.map((variant: ProductVariant, index: number) => (
              <button
                key={variant.id}
                onClick={() => onVariantChange(index)}
                className={`p-3 text-sm font-medium rounded-md border transition-colors ${
                  selectedVariant === index
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {variant.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <QuantitySelector
        quantity={quantity}
        onQuantityChange={setQuantity}
      />

      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={handleAddToCart}
            disabled={!isProductAvailable || addToCartLoading}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-colors flex items-center justify-center ${
              !isProductAvailable || addToCartLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            {addToCartLoading ? 'Adding...' : !isProductAvailable ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!isProductAvailable || buyNowLoading}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-colors flex items-center justify-center border-2 ${
              !isProductAvailable || buyNowLoading
                ? 'border-gray-300 text-gray-500 cursor-not-allowed bg-gray-50'
                : 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white bg-white'
            }`}
          >
            <Zap className="h-5 w-5 mr-2" />
            {buyNowLoading ? 'Redirecting...' : !isProductAvailable ? 'Out of Stock' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;