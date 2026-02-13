import React from 'react';
import { Store, ExternalLink, Copy, CheckCircle } from 'lucide-react';

const ShopifySetupGuide: React.FC = () => {
  const [copied, setCopied] = React.useState(false);

  const envExample = `VITE_SHOPIFY_STORE_URL=fakestore-ai.myshopify.com
VITE_SHOPIFY_API_VERSION=2025-07`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(envExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Store className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Connect Your Shopify Store
          </h1>
          <p className="text-lg text-gray-600">
            To get started, you'll need to configure your Shopify store URL
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
              1
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Your Shopify Store URL
              </h3>
              <p className="text-gray-600 mb-3">
                If you don't have a Shopify store yet, create one for free. If you already have a store, 
                find your store URL in your Shopify Admin.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://shopify.com/free-trial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Create Free Shopify Store
                </a>
                <a
                  href="https://admin.shopify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Shopify Admin
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
              2
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Find Your Store URL
              </h3>
              <p className="text-gray-600 mb-3">
                In your Shopify Admin, go to <strong>Settings → Domains</strong>. 
                Your store URL will look like <code className="bg-gray-100 px-2 py-1 rounded text-sm">your-store-name.myshopify.com</code>
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Use only the domain part (e.g., <code>your-store-name.myshopify.com</code>), 
                  not the full URL with https://
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
              3
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Configure Environment Variables
              </h3>
              <p className="text-gray-600 mb-3">
                Create or update your <code className="bg-gray-100 px-2 py-1 rounded text-sm">.env</code> file 
                in the root of your project with the following:
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{envExample}</code>
                </pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Replace <code>fakestore-ai.myshopify.com</code> with your actual Shopify store URL
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 mb-2">Important Notes:</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• This template uses Shopify's Tokenless API (no private keys required)</li>
              <li>• Your store must have products and collections to see content</li>
              <li>• The API version 2025-07 or newer is required for full functionality</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopifySetupGuide;