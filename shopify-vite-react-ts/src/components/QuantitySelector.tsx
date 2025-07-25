import React from 'react';

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onQuantityChange,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-lg font-medium text-gray-900">Quantity</label>
      <div className="flex items-center space-x-3">
        <button
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          className="w-10 h-10 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          -
        </button>
        <span className="w-12 text-center font-medium">{quantity}</span>
        <button
          onClick={() => onQuantityChange(quantity + 1)}
          className="w-10 h-10 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default QuantitySelector;