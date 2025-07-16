import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryPage from './pages/CategoryPage';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleCartClick = () => {
    setIsCartOpen(true);
  };

  const handleCartClose = () => {
    setIsCartOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onCartClick={handleCartClick}
      />
      
      <main>
        <Routes>
          <Route 
            path="/" 
            element={
              <HomePage 
                searchQuery={searchQuery} 
                onSearchChange={handleSearchChange} 
              />
            } 
          />
          <Route path="/products/:handle" element={<ProductPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/category/:handle" element={<CategoryPage />} />
        </Routes>
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={handleCartClose} />
    </div>
  );
};

export default App;