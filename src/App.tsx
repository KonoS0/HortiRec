/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Sparkles, Table, History, PlusCircle } from 'lucide-react';
import ProductForm from './components/ProductForm';
import ProductTable from './components/ProductTable';
import LaunchHistory from './components/LaunchHistory';
import { RegisteredProduct, LaunchRecord } from './types';
import { getProductCode } from './productsData';

// Storage keys for persistent state
const STORAGE_KEY = 'registeredProducts';
const HISTORY_KEY = 'productLaunchesHistory';

export default function App() {
  const [view, setView] = useState<'form' | 'table' | 'history'>('form');
  const [products, setProducts] = useState<RegisteredProduct[]>([]);
  const [launches, setLaunches] = useState<LaunchRecord[]>([]);
  const [historyFilterProduct, setHistoryFilterProduct] = useState<string | null>(null);

  // Load products and launches history on mount
  useEffect(() => {
    let loadedProducts: RegisteredProduct[] = [];

    // 1. Load cumulative products
    try {
      const savedProducts = localStorage.getItem(STORAGE_KEY);
      if (savedProducts) {
        const parsed = JSON.parse(savedProducts);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          loadedProducts = Object.values(parsed).map((item: any) => ({
            name: item.name,
            type: item.type,
            quantity: Number(Number(item.quantity || 0).toFixed(2)),
            classification: item.classification || '',
            boxes: item.boxes || undefined,
            originalWeight: item.originalWeight ? Number(Number(item.originalWeight).toFixed(2)) : undefined,
            timestamp: item.timestamp || Date.now(),
          }));
        } else if (Array.isArray(parsed)) {
          loadedProducts = parsed.map((item: any) => ({
            ...item,
            quantity: Number(Number(item.quantity || 0).toFixed(2)),
            originalWeight: item.originalWeight ? Number(Number(item.originalWeight).toFixed(2)) : undefined,
          }));
        }

        loadedProducts.sort(
          (a, b) => (b.quantity - a.quantity) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
        );
        setProducts(loadedProducts);
      }
    } catch (e) {
      console.error('Error reading localStorage registeredProducts:', e);
    }

    // 2. Load launch history records
    try {
      const savedLaunches = localStorage.getItem(HISTORY_KEY);
      if (savedLaunches) {
        const parsedLaunches: LaunchRecord[] = JSON.parse(savedLaunches);
        if (Array.isArray(parsedLaunches)) {
          // Check if there are any pre-existing products in loadedProducts not yet in history
          const recordedProductNames = new Set(parsedLaunches.map(l => l.productName));
          const missingProducts = loadedProducts.filter(p => !recordedProductNames.has(p.name));

          if (missingProducts.length > 0) {
            const missingLaunches: LaunchRecord[] = missingProducts.map((p, idx) => ({
              id: `baseline-prev-${idx}-${p.timestamp || Date.now()}`,
              timestamp: p.timestamp || Date.now(),
              productName: p.name,
              productCode: getProductCode(p.name),
              type: p.type,
              quantity: p.quantity,
              boxes: p.boxes,
              originalWeight: p.originalWeight,
              tareWeight: p.boxes ? Number((p.boxes * 1.75).toFixed(2)) : undefined,
            }));
            const completeLaunches = [...parsedLaunches, ...missingLaunches];
            setLaunches(completeLaunches);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(completeLaunches));
            return;
          }

          setLaunches(parsedLaunches);
          return;
        }
      }

      // If no history exists yet but there are already registered products from previous sessions,
      // create baseline launch entries so historical records are immediately visible
      if (loadedProducts.length > 0) {
        const initialLaunches: LaunchRecord[] = loadedProducts.map((p, idx) => ({
          id: `baseline-${idx}-${p.timestamp || Date.now()}`,
          timestamp: p.timestamp || (Date.now() - (loadedProducts.length - idx) * 60000),
          productName: p.name,
          productCode: getProductCode(p.name),
          type: p.type,
          quantity: p.quantity,
          boxes: p.boxes,
          originalWeight: p.originalWeight,
          tareWeight: p.boxes ? Number((p.boxes * 1.75).toFixed(2)) : undefined,
        }));
        setLaunches(initialLaunches);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(initialLaunches));
      }
    } catch (e) {
      console.error('Error reading localStorage productLaunchesHistory:', e);
    }
  }, []);

  // Save cumulative products list back to localStorage
  const saveProductsList = (list: RegisteredProduct[]) => {
    try {
      const sortedList = [...list].sort(
        (a, b) => (b.quantity - a.quantity) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      );
      const dictionary: Record<string, Omit<RegisteredProduct, 'timestamp'>> = {};
      sortedList.forEach((p) => {
        dictionary[p.name] = {
          name: p.name,
          type: p.type,
          quantity: Number(Number(p.quantity).toFixed(2)),
          classification: p.classification || '',
          boxes: p.boxes,
          originalWeight: p.originalWeight ? Number(Number(p.originalWeight).toFixed(2)) : undefined,
          launchCount: p.launchCount,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionary));
      setProducts(sortedList);
    } catch (e) {
      console.error('Error saving to localStorage registeredProducts:', e);
    }
  };

  // Save launches history list back to localStorage
  const saveLaunchesList = (list: LaunchRecord[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      setLaunches(list);
    } catch (e) {
      console.error('Error saving to localStorage productLaunchesHistory:', e);
    }
  };

  // Add new registered product and create corresponding launch record
  const handleAddProduct = (newProd: Omit<RegisteredProduct, 'timestamp'>) => {
    // 1. Create individual launch record
    const newLaunch: LaunchRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      productName: newProd.name,
      productCode: getProductCode(newProd.name),
      type: newProd.type,
      quantity: Number(Number(newProd.quantity).toFixed(2)),
      boxes: newProd.boxes,
      originalWeight: newProd.originalWeight ? Number(Number(newProd.originalWeight).toFixed(2)) : undefined,
      tareWeight: (newProd.boxes && newProd.boxes > 0) ? Number((newProd.boxes * 1.75).toFixed(2)) : undefined,
    };

    const updatedLaunches = [newLaunch, ...launches];
    saveLaunchesList(updatedLaunches);

    // 2. Accumulate or add into products table
    const updatedList = [...products];
    const existingIdx = updatedList.findIndex(
      p => p.name.toUpperCase() === newProd.name.toUpperCase()
    );

    if (existingIdx >= 0) {
      const combinedQuantity = Number((updatedList[existingIdx].quantity + newProd.quantity).toFixed(2));
      const combinedOriginalWeight = (updatedList[existingIdx].originalWeight || 0) + (newProd.originalWeight || 0);

      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        quantity: combinedQuantity,
        boxes: (updatedList[existingIdx].boxes || 0) + (newProd.boxes || 0) || undefined,
        originalWeight: combinedOriginalWeight ? Number(combinedOriginalWeight.toFixed(2)) : undefined,
        launchCount: (updatedList[existingIdx].launchCount || 1) + 1,
      };
    } else {
      updatedList.push({
        ...newProd,
        quantity: Number(Number(newProd.quantity).toFixed(2)),
        originalWeight: newProd.originalWeight ? Number(Number(newProd.originalWeight).toFixed(2)) : undefined,
        timestamp: Date.now(),
        launchCount: 1,
      });
    }

    saveProductsList(updatedList);
  };

  // Delete an individual launch record and recalculate cumulative table
  const handleDeleteLaunch = (launchId: string) => {
    const launchToDelete = launches.find(l => l.id === launchId);
    if (!launchToDelete) return;

    const updatedLaunches = launches.filter(l => l.id !== launchId);
    saveLaunchesList(updatedLaunches);

    const remainingForProduct = updatedLaunches.filter(l => l.productName === launchToDelete.productName);

    if (remainingForProduct.length === 0) {
      // Remove product completely from cumulative table
      const updatedList = products.filter(p => p.name !== launchToDelete.productName);
      saveProductsList(updatedList);
    } else {
      // Recalculate totals for this product
      const totalQty = Number(remainingForProduct.reduce((sum, l) => sum + l.quantity, 0).toFixed(2));
      const totalBoxes = remainingForProduct.reduce((sum, l) => sum + (l.boxes || 0), 0);
      const totalOriginalWeight = remainingForProduct.reduce((sum, l) => sum + (l.originalWeight || 0), 0);

      const updatedList = products.map(p => {
        if (p.name === launchToDelete.productName) {
          return {
            ...p,
            quantity: totalQty,
            boxes: totalBoxes > 0 ? totalBoxes : undefined,
            originalWeight: totalOriginalWeight > 0 ? Number(totalOriginalWeight.toFixed(2)) : undefined,
            launchCount: remainingForProduct.length,
          };
        }
        return p;
      });
      saveProductsList(updatedList);
    }
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

  // Delete specific products and their launches
  const handleDeleteProducts = (namesToDelete: string[]) => {
    const updatedList = products.filter(p => !namesToDelete.includes(p.name));
    saveProductsList(updatedList);

    const updatedLaunches = launches.filter(l => !namesToDelete.includes(l.productName));
    saveLaunchesList(updatedLaunches);
  };

  // Clear all products and launches
  const handleClearAll = () => {
    saveProductsList([]);
    saveLaunchesList([]);
  };

  // Clear only history
  const handleClearHistory = () => {
    saveLaunchesList([]);
  };

  // Navigate to history filtered to a specific product
  const handleViewHistory = (productName?: string) => {
    setHistoryFilterProduct(productName || 'ALL');
    setView('history');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col justify-between py-6 md:py-10 px-4">
      {/* Decorative branding bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900" />

      {/* Top Navigation Pill Bar */}
      <header className="w-full max-w-2xl mx-auto mb-6">
        <nav className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-1.5 rounded-2xl shadow-sm flex items-center justify-between gap-1">
          <button
            onClick={() => setView('form')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              view === 'form'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Formulário</span>
          </button>

          <button
            onClick={() => setView('table')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              view === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            <span>Tabela Acumulada</span>
            {products.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                view === 'table' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {products.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setHistoryFilterProduct('ALL');
              setView('history');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              view === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Histórico</span>
            {launches.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                view === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {launches.length}
              </span>
            )}
          </button>
        </nav>
      </header>

      {/* Main app grid area */}
      <main className="flex-1 flex items-center justify-center w-full max-w-6xl mx-auto py-2">
        <AnimatePresence mode="wait">
          {view === 'form' && (
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
                onViewHistory={() => {
                  setHistoryFilterProduct('ALL');
                  setView('history');
                }}
                registeredCount={products.length}
                launchesCount={launches.length}
              />
            </motion.div>
          )}

          {view === 'table' && (
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
                launches={launches}
                onBack={() => setView('form')}
                onViewHistory={handleViewHistory}
                onDeleteLaunch={handleDeleteLaunch}
                onDeleteProducts={handleDeleteProducts}
                onClearAll={handleClearAll}
                onToggleClassification={handleToggleClassification}
              />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <LaunchHistory
                launches={launches}
                products={products}
                selectedProductFilter={historyFilterProduct}
                onBackToTable={() => setView('table')}
                onBackToForm={() => setView('form')}
                onDeleteLaunch={handleDeleteLaunch}
                onClearHistory={handleClearHistory}
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
          Histórico detalhado por pesagem e tabela cumulativa com exportação PDF e CSV.
        </p>
      </footer>
    </div>
  );
}
