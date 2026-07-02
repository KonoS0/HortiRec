/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Sparkles } from 'lucide-react';
import ProductForm from './components/ProductForm';
import ProductTable from './components/ProductTable';
import { RegisteredProduct } from './types';

// Storage key matches original HTML code for 100% data compatibility
const STORAGE_KEY = 'registeredProducts';

export default function App() {
  const [view, setView] = useState<'form' | 'table'>('form');
  const [products, setProducts] = useState<RegisteredProduct[]>([]);

  // Load products on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Convert dictionary (from original HTML) to clean React list array
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const loadedList: RegisteredProduct[] = Object.values(parsed).map((item: any) => ({
            name: item.name,
            type: item.type,
            quantity: item.quantity,
            classification: item.classification || '',
            boxes: item.boxes || undefined,
            originalWeight: item.originalWeight || undefined,
            timestamp: item.timestamp || Date.now(),
          }));
          setProducts(loadedList);
        } else if (Array.isArray(parsed)) {
          setProducts(parsed);
        }
      }
    } catch (e) {
      console.error('Error reading localStorage registeredProducts:', e);
    }
  }, []);

  // Save list back as dictionary to maintain 100% compatibility with older records
  const saveProductsList = (list: RegisteredProduct[]) => {
    try {
      const dictionary: Record<string, Omit<RegisteredProduct, 'timestamp'>> = {};
      list.forEach((p) => {
        dictionary[p.name] = {
          name: p.name,
          type: p.type,
          quantity: p.quantity,
          classification: p.classification || '',
          boxes: p.boxes,
          originalWeight: p.originalWeight,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionary));
      setProducts(list);
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  };

  // Add new registered product or accumulate quantity if it already exists
  const handleAddProduct = (newProd: Omit<RegisteredProduct, 'timestamp'>) => {
    const updatedList = [...products];
    const existingIdx = updatedList.findIndex(
      p => p.name.toUpperCase() === newProd.name.toUpperCase()
    );

    if (existingIdx >= 0) {
      // Accumulate quantities and update properties
      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        quantity: updatedList[existingIdx].quantity + newProd.quantity,
        boxes: (updatedList[existingIdx].boxes || 0) + (newProd.boxes || 0) || undefined,
        originalWeight: (updatedList[existingIdx].originalWeight || 0) + (newProd.originalWeight || 0) || undefined,
      };
    } else {
      // Add as a new entry
      updatedList.push({
        ...newProd,
        timestamp: Date.now(),
      });
    }

    saveProductsList(updatedList);
  };

  // Toggle NT or QB classifications
  const handleToggleClassification = (name: string, classification: 'NT' | 'QB') => {
    const updatedList = products.map((p) => {
      if (p.name.toUpperCase() === name.toUpperCase()) {
        const currentClass = p.classification;
        return {
          ...p,
          classification: currentClass === classification ? '' : classification,
        };
      }
      return p;
    });
    saveProductsList(updatedList);
  };

  // Delete specific product keys
  const handleDeleteProducts = (namesToDelete: string[]) => {
    const updatedList = products.filter(
      p => !namesToDelete.includes(p.name)
    );
    saveProductsList(updatedList);
  };

  // Clear all products
  const handleClearAll = () => {
    saveProductsList([]);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col justify-between py-10 px-4">
      {/* Decorative branding bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900" />

      {/* Main app grid area */}
      <main className="flex-1 flex items-center justify-center w-full max-w-6xl mx-auto py-4">
        <AnimatePresence mode="wait">
          {view === 'form' ? (
            <motion.div
              key="form-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full flex justify-center"
            >
              <ProductForm
                onAddProduct={handleAddProduct}
                onViewTable={() => setView('table')}
                registeredCount={products.length}
              />
            </motion.div>
          ) : (
            <motion.div
              key="table-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <ProductTable
                products={products}
                onBack={() => setView('form')}
                onDeleteProducts={handleDeleteProducts}
                onClearAll={handleClearAll}
                onToggleClassification={handleToggleClassification}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Clean minimalist footer */}
      <footer className="mt-12 text-center text-[10px] text-slate-400 font-sans tracking-wide">
        <div className="flex items-center justify-center gap-1.5 font-medium text-slate-500">
          <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
          <span>Sistema de Registro de Hortifrúti • HortiBar</span>
        </div>
        <p className="mt-1">
          Exportador de PDF ultra leve com resolução vetorial aprimorada.
        </p>
      </footer>
    </div>
  );
}
