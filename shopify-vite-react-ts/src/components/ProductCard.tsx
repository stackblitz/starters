import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, ShoppingCart, Zap } from 'lucide-react';
import { Product } from '../types/shopify';
import { formatPrice, createCheckoutPermalink } from '../utils/shopify';
import { useCartContext } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const { addToCart } = useCartContext();
  
  const firstVariant = product.variants.nodes[0];
  const isOnSale = firstVariant?.compareAtPrice && 
    parseFloat(firstVariant.compareAtPrice.amount) > parseFloat(firstVariant.price.amount);
  
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!firstVariant || !product.availableForSale) return;
    
    try {
      await addToCart([
        {
          merchandiseId: firstVariant.id,
          quantity: 1,
        },
      ]);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!firstVariant || !product.availableForSale) return;
    
    const checkoutUrl = createCheckoutPermalink([
      {
        id: firstVariant.id.split('/').pop() || '',
        quantity: 1,
      },
    ]);
    
    window.open(checkoutUrl, '_blank');
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onQuickView) {
      onQuickView(product);
    }
  };

  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
      <Link to={`/products/${product.handle}`} className="block">
        <div className="relative overflow-hidden rounded-t-lg bg-gray-100 aspect-square">
          {product.images.nodes.length > 0 ? (
            <img
              src={product.images.nodes[0].url}
              alt={product.images.nodes[0].altText || product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
          
          {/* Sale Badge */}
          {isOnSale && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 text-xs font-medium rounded">
              Sale
            </div>
          )}
          
          {/* Out of Stock Badge */}
          {!product.availableForSale && (
            <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 text-xs font-medium rounded">
              Out of Stock
            </div>
          )}
          
          {/* Hover Actions */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex space-x-2">
              {onQuickView && (
                <button
                  onClick={handleQuickView}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
                  title="Quick View"
                >
                  <Eye className="h-4 w-4 text-gray-700" />
                </button>
              )}
              
              {product.availableForSale && (
                <>
                  <button
                    onClick={handleAddToCart}
                    className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
                    title="Add to Cart"
                  >
                    <ShoppingCart className="h-4 w-4 text-gray-700" />
                  </button>
                  
                  <button
                    onClick={handleBuyNow}
                    className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
                    title="Buy Now"
                  >
                    <Zap className="h-4 w-4 text-gray-700" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
            {product.title}
          </h3>
          
          {product.vendor && (
            <p className="text-xs text-gray-500 mb-2">{product.vendor}</p>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-semibold text-gray-900">
                {formatPrice(firstVariant?.price)}
              </span>
              {isOnSale && firstVariant?.compareAtPrice && (
                <span className="text-sm text-gray-500 line-through">
                  {formatPrice(firstVariant.compareAtPrice)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;