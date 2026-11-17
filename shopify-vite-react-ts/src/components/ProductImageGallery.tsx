import React from 'react';
import { ShopifyProduct } from '../types/shopify';

type ProductImage = ShopifyProduct['images']['nodes'][0];

interface ProductImageGalleryProps {
  images: ProductImage[];
  productTitle: string;
  selectedImage: number;
  onImageSelect: (index: number) => void;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  images,
  productTitle,
  selectedImage,
  onImageSelect,
}) => {
  return (
    <div className="space-y-4">
      <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden">
        {images[selectedImage] ? (
          <img
            src={images[selectedImage].url}
            alt={images[selectedImage].altText || productTitle}
            className="w-full h-96 lg:h-[500px] object-cover"
          />
        ) : (
          <div className="w-full h-96 lg:h-[500px] bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image</span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex space-x-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => onImageSelect(index)}
              className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                selectedImage === index ? 'border-blue-600' : 'border-gray-200'
              }`}
            >
              <img
                src={image.url}
                alt={image.altText || productTitle}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;