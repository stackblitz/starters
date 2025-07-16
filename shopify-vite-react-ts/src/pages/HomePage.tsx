import React, { useState } from 'react';
import ProductGrid from '../components/ProductGrid';
import { useProducts } from '../hooks/useShopify';

interface HomePageProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ searchQuery, onSearchChange }) => {
  const { products, loading, error, hasNextPage, loadMore, refetch } = useProducts(searchQuery);

  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Welcome to MockStore
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            Discover amazing products at unbeatable prices
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Shop Now
            </button>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <section id="products" className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {searchQuery ? `Search Results for "${searchQuery}"` : 'All Products'}
          </h2>
          <p className="text-gray-600">
            {searchQuery ? 
              `Found ${products.length} products matching your search` : 
              'Discover our complete collection of products'
            }
          </p>
        </div>

        <ProductGrid
          products={products}
          loading={loading}
          error={error}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
        />
      </section>
    </>
  );
};

export default HomePage;