import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { useCollectionProducts } from '../hooks/useShopify';
import ProductGrid from '../components/ProductGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const CategoryPage: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const { collection, loading, error } = useCollectionProducts(handle || '');

  if (loading && !collection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600 mb-2">Collection Not Found</h3>
          <p className="text-gray-500 mb-4">The collection you're looking for doesn't exist.</p>
          <Link
            to="/categories"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Collection Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/categories"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Categories
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {collection.image && (
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src={collection.image.url}
                  alt={collection.image.altText || collection.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {collection.title}
              </h1>
              {collection.description && (
                <p className="text-lg text-gray-600 mb-4">
                  {collection.description}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {collection.products.nodes.length} products in this collection
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="py-12">
        {collection.products.nodes.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">No Products Found</h3>
            <p className="text-gray-500">This collection doesn't have any products yet.</p>
          </div>
        ) : (
          <ProductGrid
            products={collection.products.nodes}
            loading={loading}
            error={null}
            hasNextPage={false}
            onLoadMore={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export default CategoryPage;