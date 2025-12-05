import React, { useState } from 'react';
import { isShopifyConfigured } from './utils/shopify';
import ShopifySetupGuide from './components/ShopifySetupGuide';
import { useProducts } from './hooks/useShopify';
import { useCartContext } from './hooks/useCartContext';
import CartDrawer from './components/CartDrawer';
import Header from './components/Header';
import ProductImageGallery from './components/ProductImageGallery';
import ProductDetails from './components/ProductDetails';
import { LoadingState, ErrorState, EmptyState } from './components/StateComponents';
import { ShopifyProduct } from './types/shopify';

const App: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { products, loading, error } = useProducts();
  const { cart } = useCartContext();
  
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [randomProduct, setRandomProduct] = useState<ShopifyProduct | null>(null);

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
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!randomProduct) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        cartQuantity={cart?.totalQuantity || 0}
        onCartClick={() => setIsCartOpen(true)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <ProductImageGallery
            images={randomProduct.images.nodes}
            productTitle={randomProduct.title}
            selectedImage={selectedImage}
            onImageSelect={setSelectedImage}
          />

          <ProductDetails
            vendor={randomProduct.vendor}
            title={randomProduct.title}
            description={randomProduct.description}
            variants={randomProduct.variants.nodes}
            selectedVariant={selectedVariant}
            onVariantChange={setSelectedVariant}
          />
        </div>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};

export default App;