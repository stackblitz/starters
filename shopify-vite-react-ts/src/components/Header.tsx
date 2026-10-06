import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface HeaderProps {
  cartQuantity: number;
  onCartClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartQuantity, onCartClick }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <div className="text-2xl font-bold text-gray-900">
              Mock<span className="text-blue-600">Store</span>
            </div>
          </div>
          <button
            onClick={onCartClick}
            className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors"
          >
            <ShoppingCart className="h-6 w-6" />
            {cartQuantity > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {cartQuantity}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;