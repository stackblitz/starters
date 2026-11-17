import React from 'react';
import { Store } from 'lucide-react';

export const LoadingState: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

interface ErrorStateProps {
  error: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="text-red-600 mb-4">⚠️</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-gray-600">{error}</p>
    </div>
  </div>
);

export const EmptyState: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-xl font-medium text-gray-600 mb-2">No Products Found</h3>
      <p className="text-gray-500">Please add products to your Shopify store.</p>
    </div>
  </div>
);