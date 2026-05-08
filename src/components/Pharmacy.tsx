import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Star, 
  ShoppingBasket, 
  Plus, 
  Minus, 
  Heart,
  ChevronRight,
  TrendingUp,
  Package,
  Zap,
  Truck,
  History,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { products, Product } from '../lib/products';

export default function Pharmacy() {
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    // Simulate data loading for polished entry
    const timer = setTimeout(() => {
      setProductsLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!productsLoaded) {
    return <LoadingScreen />;
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'All Products' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'medication', label: 'Medication' },
    { id: 'supplement', label: 'Supplements' },
    { id: 'wellness', label: 'Wellness' },
  ];

  const addToCart = (id: string) => {
    setCart(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[id] > 1) {
        newCart[id]--;
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(cart).reduce((total, [id, qty]) => {
    const product = products.find(p => p.id === id);
    return total + (product?.price || 0) * qty;
  }, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-[0.2em]">
            <Plus size={14} />
            Clinical Pharmacy
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Health Shop</h2>
          <p className="text-slate-500 font-medium">Equip your journey with premium medical tools and supplements.</p>
        </div>
        
        <button 
          onClick={() => setIsCartOpen(true)}
          className="px-6 py-4 bg-slate-900 text-white rounded-3xl font-bold flex items-center gap-3 hover:bg-black transition-all shadow-2xl shadow-slate-200 relative"
        >
          <ShoppingBag size={20} />
          Cart
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-lg">
              {totalItems}
            </span>
          )}
        </button>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-100">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <ShoppingBasket size={200} />
        </div>
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest border border-white/20">
            <Zap size={14} />
            Exclusive Member Rates
          </div>
          <h3 className="text-4xl md:text-5xl font-black leading-tight">Elite Equipment for Pulse Members</h3>
          <p className="text-blue-100 text-lg font-medium opacity-90">
            Verified clinical tools and laboratory-tested supplements. Shipped securely to your doorstep within 48 hours.
          </p>
          <div className="flex items-center gap-4 pt-4">
            <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-50 transition-all flex items-center gap-2">
              Browse All
              <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-80">
              <TrendingUp size={16} />
              Save up to 20% on Annual Plan
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <Search size={20} className="text-slate-400 ml-4" />
          <input 
            type="text" 
            placeholder="Search equipment, vitamins, or supplies..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none py-3 font-semibold text-slate-700 placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                selectedCategory === cat.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Buttons */}
      {products.length > 0 && <Buttons />}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProducts.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-[40px] border border-slate-50 shadow-sm overflow-hidden group hover:shadow-2xl hover:shadow-slate-200 transition-all"
          >
            <div className="aspect-square relative overflow-hidden">
              <img 
                src={product.image} 
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button className="p-3 bg-white/80 backdrop-blur-md rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                  <Heart size={20} />
                </button>
                <div className="p-3 bg-white/80 backdrop-blur-md rounded-2xl text-slate-900 font-black text-xs shadow-sm flex items-center gap-1">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  {product.rating}
                </div>
              </div>
              <div className="absolute bottom-4 left-4">
                <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  {product.category}
                </span>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{product.name}</h4>
                <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed">
                  {product.description}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                  <p className="text-2xl font-black text-slate-900">${product.price.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => addToCart(product.id)}
                  className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-blue-100"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[110] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <ShoppingBag size={20} />
                  </div>
                  <h3 className="text-xl font-bold">Your Cart</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {totalItems === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                      <ShoppingBasket size={48} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Your cart is empty</h4>
                      <p className="text-sm text-slate-400">Add medical supplies or supplements to get started.</p>
                    </div>
                  </div>
                ) : (
                  Object.entries(cart).map(([id, qty]) => {
                    const product = products.find(p => p.id === id);
                    if (!product) return null;
                    return (
                      <div key={id} className="flex gap-4 group">
                        <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden shrink-0">
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <h5 className="font-bold text-slate-900 text-sm">{product.name}</h5>
                          <p className="text-xs text-slate-400 uppercase font-black tracking-widest">{product.category}</p>
                          <div className="flex items-center justify-between pt-2">
                            <p className="font-black text-blue-600 text-sm">${(product.price * qty).toFixed(2)}</p>
                            <div className="flex items-center gap-3 bg-slate-50 px-2 py-1 rounded-lg">
                              <button onClick={() => removeFromCart(id)} className="p-1 hover:text-red-600 transition-colors">
                                <Minus size={14} />
                              </button>
                              <span className="text-xs font-black w-4 text-center">{qty}</span>
                              <button onClick={() => addToCart(id)} className="p-1 hover:text-blue-600 transition-colors">
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                    <span>Subtotal</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  disabled={totalItems === 0}
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
                >
                  Checkout Now
                </button>
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <Package size={12} />
                  Safe & Sterile Packaging Guaranteed
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Buttons() {
  const actions = [
    { label: 'Track Order', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Order History', icon: History, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Chat with Pharmacist', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="flex flex-wrap gap-4">
      {actions.map((action, idx) => (
        <button
          key={idx}
          className="flex-1 min-w-[200px] flex items-center gap-4 p-5 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
        >
          <div className={`w-12 h-12 ${action.bg} ${action.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
            <action.icon size={20} />
          </div>
          <span className="font-bold text-slate-700 text-sm whitespace-nowrap">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500">
      <div className="relative">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 3,
            ease: "easeInOut"
          }}
          className="w-20 h-20 bg-blue-600 rounded-[24px] shadow-2xl shadow-blue-200 flex items-center justify-center text-white relative z-10"
        >
          <Plus size={40} />
        </motion.div>
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 bg-blue-400 rounded-full blur-2xl"
        />
      </div>
      <div className="space-y-3 text-center">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Syncing Clinical Inventory</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
          Verifying Sterilization & Batch Records
        </p>
      </div>
    </div>
  );
}
