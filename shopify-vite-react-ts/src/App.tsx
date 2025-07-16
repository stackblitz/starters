import React, { useState } from 'react';
import { ShoppingCart, Zap, Store } from 'lucide-react';
import { isShopifyConfigured } from './utils/shopify';
import ShopifySetupGuide from './components/ShopifySetupGuide';
import { useProducts } from './hooks/useShopify';
import { useCartContext } from './context/CartContext';
import { formatPrice, createCheckoutPermalink } from './utils/shopify';
import CartDrawer from './components/CartDrawer';

const App: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { products, loading, error } = useProducts();
  const { addToCart, cart } = useCartContext();
  
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [randomProduct, setRandomProduct] = useState(null);

  React.useEffect(() => {
    if (products.length > 0 && !randomProduct) {
      const randomIndex = Math.floor(Math.random() * products.length);
      setRandomProduct(products[randomIndex]);
    }
  }, [products, randomProduct]);

  if (!isShopifyConfigured()) {
    return <ShopifySetupGuide />;
  }

  if (loading && !randomProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!randomProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600 mb-2">No Products Found</h3>
          <p className="text-gray-500">Please add products to your Shopify store.</p>
        </div>
      </div>
    );
  }

  const currentVariant = randomProduct.variants.nodes[selectedVariant];
  const isProductAvailable = currentVariant?.availableForSale && randomProduct.availableForSale;
  const isOnSale = currentVariant?.compareAtPrice && 
    parseFloat(currentVariant.compareAtPrice.amount) > parseFloat(currentVariant.price.amount);

  const handleAddToCart = async () => {
    if (!currentVariant || !isProductAvailable) return;

    setIsAddingToCart(true);
    try {
      await addToCart([
        {
          merchandiseId: currentVariant.id,
          quantity,
        },
      ]);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!currentVariant || !isProductAvailable) return;

    setIsBuyingNow(true);
    try {
      const checkoutUrl = createCheckoutPermalink(currentVariant.id, quantity);
      
      const isInIframe = window.self !== window.top;
      
      if (isInIframe) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to create buy now link:', error);
    } finally {
      setIsBuyingNow(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <div className="text-2xl font-bold text-gray-900">
                Mock<span className="text-blue-600">Store</span>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
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
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden">
              {randomProduct.images.nodes[selectedImage] ? (
                <img
                  src={randomProduct.images.nodes[selectedImage].url}
                  alt={randomProduct.images.nodes[selectedImage].altText || randomProduct.title}
                  className="w-full h-96 lg:h-[500px] object-cover"
                />
              ) : (
                <div className="w-full h-96 lg:h-[500px] bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No image</span>
                </div>
              )}
            </div>

            {randomProduct.images.nodes.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto">
                {randomProduct.images.nodes.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-blue-600' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={image.altText || randomProduct.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {randomProduct.vendor && (
              <p className="text-sm text-blue-600 font-medium">{randomProduct.vendor}</p>
            )}

            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
              {randomProduct.title}
            </h1>

            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(currentVariant.price)}
                </span>
                {isOnSale && currentVariant.compareAtPrice && (
                  <span className="text-xl text-gray-500 line-through">
                    {formatPrice(currentVariant.compareAtPrice)}
                  </span>
                )}
                {isOnSale && (
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-sm font-medium">
                    Sale
                  </span>
                )}
              </div>
              {!isProductAvailable && (
                <p className="text-red-600 font-medium">Out of Stock</p>
              )}
            </div>

            {randomProduct.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-600">{randomProduct.description}</p>
              </div>
            )}

            {randomProduct.variants.nodes.length > 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Options</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {randomProduct.variants.nodes.map((variant, index) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(index)}
                      className={`p-3 text-sm font-medium rounded-md border transition-colors ${
                        selectedVariant === index
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {variant.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-lg font-medium text-gray-900">Quantity</label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  onClick={handleAddToCart}
                  disabled={!isProductAvailable || isAddingToCart}
                  className={`flex-1 py-3 px-6 rounded-md font-medium transition-colors flex items-center justify-center ${
                    !isProductAvailable || isAddingToCart
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {isAddingToCart ? 'Adding...' : !isProductAvailable ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={!isProductAvailable || isBuyingNow}
                  className={`flex-1 py-3 px-6 rounded-md font-medium transition-colors flex items-center justify-center border-2 ${
                    !isProductAvailable || isBuyingNow
                      ? 'border-gray-300 text-gray-500 cursor-not-allowed bg-gray-50'
                      : 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white bg-white'
                  }`}
                >
                  <Zap className="h-5 w-5 mr-2" />
                  {isBuyingNow ? 'Redirecting...' : !isProductAvailable ? 'Out of Stock' : 'Buy Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};

export default App;