import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Share2, Star, Truck, Shield, RotateCcw, Zap } from 'lucide-react';
import { useProduct } from '../hooks/useShopify';
import { useCartContext } from '../context/CartContext';
import { formatPrice, createCheckoutPermalink } from '../utils/shopify';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const ProductPage: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const { product, loading, error } = useProduct(handle || '');
  const { addToCart } = useCartContext();
  
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

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

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-600 mb-2">Product Not Found</h3>
          <p className="text-gray-500 mb-4">The product you're looking for doesn't exist.</p>
          <Link
            to="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const currentVariant = product.variants.nodes[selectedVariant];
  const isProductAvailable = currentVariant?.availableForSale && product.availableForSale;
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

  const handleShare = async () => {
    const shareData = {
      title: product.title,
      text: `Check out ${product.title} on MockStore`,
      url: window.location.href,
    };

    // Check if Web Share API is supported
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShowShareMenu(false);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to custom share menu
          setShowShareMenu(!showShareMenu);
        }
      }
    } else {
      // Fallback to custom share menu
      setShowShareMenu(!showShareMenu);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareMenu(false);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const shareToSocial = (platform: string) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out ${product.title} on MockStore`);
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(product.title)}&body=${text}%20${url}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
      setShowShareMenu(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden">
              {product.images.nodes[selectedImage] ? (
                <img
                  src={product.images.nodes[selectedImage].url}
                  alt={product.images.nodes[selectedImage].altText || product.title}
                  className="w-full h-96 lg:h-[500px] object-cover"
                />
              ) : (
                <div className="w-full h-96 lg:h-[500px] bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No image</span>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product.images.nodes.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto">
                {product.images.nodes.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-blue-600' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={image.altText || product.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Vendor */}
            {product.vendor && (
              <p className="text-sm text-blue-600 font-medium">{product.vendor}</p>
            )}

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
              {product.title}
            </h1>

            {/* Rating (Mock) */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < 4 ? 'text-yellow-400 fill-current' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">(4.0) • 127 reviews</span>
            </div>

            {/* Price */}
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

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-600">{product.description}</p>
              </div>
            )}

            {/* Variant Selection */}
            {product.variants.nodes.length > 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Options</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {product.variants.nodes.map((variant, index) => (
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

            {/* Quantity */}
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

            {/* Action Buttons */}
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

              {/* Secondary Actions */}
            </div>

            {/* Features */}
            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Truck className="h-5 w-5" />
                <span>Free shipping on orders over $50</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Shield className="h-5 w-5" />
                <span>Secure payment & data protection</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <RotateCcw className="h-5 w-5" />
                <span>30-day return policy</span>
              </div>
            </div>

            {/* Product Details */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Product Details</h3>
              
              {/* Share Button - moved to less prominent position */}
              <div className="relative">
                <button 
                  onClick={handleShare}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors flex items-center"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share this product
                </button>
                
                {/* Share Menu */}
                {showShareMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
                    <div className="p-2 space-y-1">
                      <button
                        onClick={copyToClipboard}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => shareToSocial('twitter')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Share on X
                      </button>
                      <button
                        onClick={() => shareToSocial('facebook')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Share on Facebook
                      </button>
                      <button
                        onClick={() => shareToSocial('linkedin')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Share on LinkedIn
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {product.vendor && (
                  <div>
                    <span className="font-medium text-gray-900">Brand:</span>
                    <span className="ml-2 text-gray-600">{product.vendor}</span>
                  </div>
                )}
                {product.productType && (
                  <div>
                    <span className="font-medium text-gray-900">Type:</span>
                    <span className="ml-2 text-gray-600">{product.productType}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-900">SKU:</span>
                  <span className="ml-2 text-gray-600">{currentVariant.id.split('/').pop()}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-900">Availability:</span>
                  <span className={`ml-2 ${isProductAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {isProductAvailable ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {product.tags.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;