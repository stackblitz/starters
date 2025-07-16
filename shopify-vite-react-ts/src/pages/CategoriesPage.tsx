import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { useCollections } from '../hooks/useShopify';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { formatPrice } from '../utils/shopify';

const CategoriesPage: React.FC = () => {
  const { collections, loading, error } = useCollections();

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Package className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Shop by Category
          </h1>
          <p className="text-xl md:text-2xl opacity-90">
            Explore our curated collections and find exactly what you're looking for
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {collections.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">No Collections Found</h3>
              <p className="text-gray-500">Collections will appear here once they're created in your Shopify store.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  to={`/category/${collection.handle}`}
                  className="group bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
                >
                  {/* Collection Image */}
                  <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                    {collection.image ? (
                      <img
                        src={collection.image.url}
                        alt={collection.image.altText || collection.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <Package className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Collection Info */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {collection.title}
                      </h3>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    
                    {collection.description && (
                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {collection.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{collection.products.nodes.length} products</span>
                      {collection.products.nodes.length > 0 && (
                        <span>
                          From {formatPrice(collection.products.nodes[0].priceRange?.minVariantPrice || collection.products.nodes[0].variants.nodes[0].price)}
                        </span>
                      )}
                    </div>

                    {/* Product Preview */}
                    {collection.products.nodes.length > 0 && (
                      <div className="mt-4 flex -space-x-2">
                        {collection.products.nodes.slice(0, 4).map((product, index) => (
                          <div
                            key={product.id}
                            className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden"
                            style={{ zIndex: 4 - index }}
                          >
                            {product.images.nodes[0] ? (
                              <img
                                src={product.images.nodes[0].url}
                                alt={product.images.nodes[0].altText || product.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-300" />
                            )}
                          </div>
                        ))}
                        {collection.products.nodes.length > 4 && (
                          <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                            +{collection.products.nodes.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;