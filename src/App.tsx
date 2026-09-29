/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, PlusCircle, Table as TableIcon, CalendarDays } from 'lucide-react';
import ProductForm from './components/ProductForm';
import ProductTable from './components/ProductTable';
import HistoryAndPeriods from './components/HistoryAndPeriods';
import { RegisteredProduct, ProductLaunchEntry } from './types';

// Storage keys
const STORAGE_KEY = 'registeredProducts';
const HISTORY_STORAGE_KEY = 'productLaunchHistory';
const TABLE_DATE_KEY = 'tableCreationDate';

export default function App() {
  const [view, setView] = useState<'form' | 'table' | 'periods'>('form');
  const [products, setProducts] = useState<RegisteredProduct[]>([]);
  const [history, setHistory] = useState<ProductLaunchEntry[]>([]);
  const [tableCreatedAt, setTableCreatedAt] = useState<number | null>(null);

  // Load products, history and creation date on mount
  useEffect(() => {
    try {
      // 1. Load consolidated products
      const savedProducts = localStorage.getItem(STORAGE_KEY);
      let loadedList: RegisteredProduct[] = [];
      if (savedProducts) {
        const parsed = JSON.parse(savedProducts);
        
        // Convert dictionary (from original HTML) to clean React list array
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          loadedList = Object.values(parsed).map((item: any) => ({
            name: item.name,
            type: item.type,
            quantity: Number(Number(item.quantity || 0).toFixed(2)),
            classification: item.classification || '',
            boxes: item.boxes || undefined,
            originalWeight: item.originalWeight ? Number(Number(item.originalWeight).toFixed(2)) : undefined,
            timestamp: item.timestamp || Date.now(),
          }));
        } else if (Array.isArray(parsed)) {
          loadedList = parsed.map((item: any) => ({
            ...item,
            quantity: Number(Number(item.quantity || 0).toFixed(2)),
            originalWeight: item.originalWeight ? Number(Number(item.originalWeight).toFixed(2)) : undefined,
          }));
        }

        loadedList.sort((a, b) => (b.quantity - a.quantity) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        setProducts(loadedList);
      }

      // 2. Load table persistent creation date: if table is not deleted, the date is never updated!
      const savedTableDate = localStorage.getItem(TABLE_DATE_KEY);
      if (savedTableDate && loadedList.length > 0) {
        setTableCreatedAt(Number(savedTableDate));
      } else if (loadedList.length > 0) {
        // Derive earliest timestamp from products if not explicitly stored
        const earliest = Math.min(...loadedList.map(p => p.timestamp || Date.now()));
        setTableCreatedAt(earliest);
        localStorage.setItem(TABLE_DATE_KEY, String(earliest));
      } else {
        setTableCreatedAt(null);
      }

      // 3. Load launch history
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setHistory(parsedHistory);
        }
      } else if (loadedList.length > 0) {
        // Create initial history records from current products if history didn't exist yet
        const initialHistory: ProductLaunchEntry[] = loadedList.map((p, idx) => ({
          id: `initial_${p.name}_${idx}`,
          productName: p.name,
          type: p.type,
          inputQuantity: p.originalWeight || p.quantity,
          boxes: p.boxes,
          tareWeight: p.boxes ? Number((p.boxes * 1.75).toFixed(2)) : undefined,
          netQuantity: p.quantity,
          classification: p.classification,
          timestamp: p.timestamp || Date.now(),
        }));
        setHistory(initialHistory);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(initialHistory));
      }
    } catch (e) {
      console.error('Error reading localStorage registeredProducts:', e);
    }
  }, []);

  // Save list back as dictionary to maintain 100% compatibility with older records
  const saveProductsList = (list: RegisteredProduct[]) => {
    try {
      const sortedList = [...list].sort((a, b) =>
        (b.quantity - a.quantity) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
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
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionary));
      setProducts(sortedList);
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  };

  // Save history list to localStorage
  const saveHistoryList = (list: ProductLaunchEntry[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
      setHistory(list);
    } catch (e) {
      console.error('Error saving history to localStorage:', e);
    }
  };

  // Add new registered product and record an individual launch
  const handleAddProduct = (
    newProd: Omit<RegisteredProduct, 'timestamp'>,
    launchMeta?: { inputQuantity: number; tareWeight?: number }
  ) => {
    const timestamp = Date.now();

    // 1. Establish session creation date if table is currently empty
    if (products.length === 0 || !tableCreatedAt) {
      setTableCreatedAt(timestamp);
      localStorage.setItem(TABLE_DATE_KEY, String(timestamp));
    }

    // 2. Record individual launch entry
    const newLaunch: ProductLaunchEntry = {
      id: `launch_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      productName: newProd.name,
      type: newProd.type,
      inputQuantity: launchMeta?.inputQuantity ?? (newProd.originalWeight || newProd.quantity),
      boxes: newProd.boxes,
      tareWeight: launchMeta?.tareWeight ?? (newProd.boxes ? Number((newProd.boxes * 1.75).toFixed(2)) : 0),
      netQuantity: Number(newProd.quantity.toFixed(2)),
      classification: newProd.classification,
      timestamp,
    };
    saveHistoryList([newLaunch, ...history]);

    // 3. Accumulate in consolidated table
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
      };
    } else {
      updatedList.push({
        ...newProd,
        quantity: Number(Number(newProd.quantity).toFixed(2)),
        originalWeight: newProd.originalWeight ? Number(Number(newProd.originalWeight).toFixed(2)) : undefined,
        timestamp,
      });
    }

    saveProductsList(updatedList);
  };

  // Delete an individual launch and deduct from consolidated products if present
  const handleDeleteLaunch = (launchId: string) => {
    const targetLaunch = history.find(h => h.id === launchId);
    if (!targetLaunch) return;

    // Remove from history
    const updatedHistory = history.filter(h => h.id !== launchId);
    saveHistoryList(updatedHistory);

    // Deduct from consolidated table
    const targetIdx = products.findIndex(
      p => p.name.toUpperCase() === targetLaunch.productName.toUpperCase()
    );

    if (targetIdx >= 0) {
      const current = products[targetIdx];
      const newQuantity = Number((current.quantity - targetLaunch.netQuantity).toFixed(2));
      const newBoxes = Math.max(0, (current.boxes || 0) - (targetLaunch.boxes || 0));
      const newOrigWeight = current.originalWeight && targetLaunch.inputQuantity
        ? Number(Math.max(0, current.originalWeight - targetLaunch.inputQuantity).toFixed(2))
        : undefined;

      if (newQuantity <= 0.001) {
        const remaining = products.filter((_, idx) => idx !== targetIdx);
        saveProductsList(remaining);
        if (remaining.length === 0) {
          setTableCreatedAt(null);
          localStorage.removeItem(TABLE_DATE_KEY);
        }
      } else {
        const updated = [...products];
        updated[targetIdx] = {
          ...current,
          quantity: newQuantity,
          boxes: newBoxes > 0 ? newBoxes : undefined,
          originalWeight: newOrigWeight,
        };
        saveProductsList(updated);
      }
    }
  };

  const handleClearHistory = () => {
    saveHistoryList([]);
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

    // If all products were deleted, clear table date
    if (updatedList.length === 0) {
      setTableCreatedAt(null);
      localStorage.removeItem(TABLE_DATE_KEY);
    }
  };

  // Clear all products: resets date so the next registration creates a new date!
  const handleClearAll = () => {
    saveProductsList([]);
    setTableCreatedAt(null);
    localStorage.removeItem(TABLE_DATE_KEY);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col justify-between py-6 md:py-10 px-4">
      {/* Decorative branding bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900" />

      {/* Top Header & View Switcher */}
      <header className="w-full max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-900 text-white rounded-lg">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight font-sans">
              HortiBar • Registro & Pesagem
            </h1>
            <p className="text-[10px] text-slate-400">
              Controle de peso líquido, histórico por períodos e código de barras
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center bg-white border border-slate-200/90 rounded-2xl p-1 shadow-xs text-xs font-semibold">
          <button
            onClick={() => setView('form')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              view === 'form'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Registrar</span>
          </button>

          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              view === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Tabela Atual</span>
            {products.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                view === 'table' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {products.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setView('periods')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              view === 'periods'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Lançamentos & Períodos</span>
            {history.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                view === 'periods' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {history.length}
              </span>
            )}
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
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
                onViewPeriodsHistory={() => setView('periods')}
                registeredCount={products.length}
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
                onBack={() => setView('form')}
                onViewPeriodsHistory={() => setView('periods')}
                tableCreatedAt={tableCreatedAt}
                onDeleteProducts={handleDeleteProducts}
                onClearAll={handleClearAll}
                onToggleClassification={handleToggleClassification}
              />
            </motion.div>
          )}

          {view === 'periods' && (
            <motion.div
              key="periods-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <HistoryAndPeriods
                history={history}
                onBack={() => setView('form')}
                onViewTable={() => setView('table')}
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
          Exportador de PDF ultra leve com resolução vetorial aprimorada e histórico por períodos.
        </p>
      </footer>
    </div>
  );
}
