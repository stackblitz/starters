import React from 'react';
import { Loader2 } from 'lucide-react';
import { ShopifyProduct } from '../types/shopify';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: ShopifyProduct[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onQuickView?: (product: ShopifyProduct) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  loading,
  error,
  hasNextPage,
  onLoadMore,
  onQuickView,
}) => {
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="h-12 w-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-lg font-medium">Failed to load products</p>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && products.length === 0) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-600">Loading products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="h-12 w-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm text-gray-600 mt-1">Try adjusting your search or filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onQuickView={onQuickView}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasNextPage && (
        <div className="text-center mt-12">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              'Load More Products'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;