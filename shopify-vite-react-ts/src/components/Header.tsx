import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X } from 'lucide-react';
import { useCartContext } from '../context/CartContext';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  onCartClick: () => void;
  searchQuery: string;
}

const Header: React.FC<HeaderProps> = ({ onSearchChange, onCartClick, searchQuery }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { cart } = useCartContext();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('search') as string;
    onSearchChange(query);
    
    // Navigate to home page if not already there
    if (location.pathname !== '/') {
      navigate('/');
    }
    
    setIsSearchOpen(false);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              Mock<span className="text-blue-600">Store</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link 
              to="/" 
              className={`transition-colors ${
                location.pathname === '/' 
                  ? 'text-blue-600 font-medium' 
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              All Products
            </Link>
            <Link 
              to="/categories" 
              className={`transition-colors ${
                location.pathname === '/categories' 
                  ? 'text-blue-600 font-medium' 
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              Categories
            </Link>
          </nav>

          {/* Desktop Search */}
          <div className="hidden md:flex items-center space-x-4">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  name="search"
                  placeholder="Search products..."
                  defaultValue={searchQuery}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
            </form>

            {/* Cart Button */}
            <button
              onClick={onCartClick}
              className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart && cart.totalQuantity > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cart.totalQuantity}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Search className="h-6 w-6" />
            </button>
            <button
              onClick={onCartClick}
              className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart && cart.totalQuantity > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cart.totalQuantity}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-700 hover:text-blue-600 transition-colors"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        {isSearchOpen && (
          <div className="md:hidden py-4 border-t">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  name="search"
                  placeholder="Search products..."
                  defaultValue={searchQuery}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                />
              </div>
            </form>
          </div>
        )}

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <Link 
                to="/" 
                className={`transition-colors ${
                  location.pathname === '/' 
                    ? 'text-blue-600 font-medium' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                All Products
              </Link>
              <Link 
                to="/categories" 
                className={`transition-colors ${
                  location.pathname === '/categories' 
                    ? 'text-blue-600 font-medium' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Categories
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;