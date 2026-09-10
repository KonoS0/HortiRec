/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react';
import { Plus, Table, AlertCircle, Sparkles, Scale, Info, Check, PackageOpen } from 'lucide-react';
import { PRODUCTS_DATABASE } from '../productsData';
import { RegisteredProduct } from '../types';

interface ProductFormProps {
  onAddProduct: (product: Omit<RegisteredProduct, 'timestamp'>) => void;
  onViewTable: () => void;
  registeredCount: number;
}

const WEIGHT_PER_BOX = 1.75;

export default function ProductForm({ onAddProduct, onViewTable, registeredCount }: ProductFormProps) {
  const [productName, setProductName] = useState('');
  const [measureType, setMeasureType] = useState('');
  const [boxes, setBoxes] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Autocomplete states
  const [suggestions, setSuggestions] = useState<typeof PRODUCTS_DATABASE>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products based on input
  const handleNameChange = (val: string) => {
    setProductName(val);
    setFocusedSuggestionIndex(-1);
    setErrorMsg(null); // Clear error when typing

    if (!val.trim()) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setMeasureType('');
      return;
    }

    const searchStr = val.toLowerCase().trim();
    const cleanSearch = searchStr.replace(/\s+(kg|un|bj|cx|pt|sc|dz|gf|po)$/i, '');
    const searchNoHyphen = searchStr.replace(/-/g, '');

    const filtered = PRODUCTS_DATABASE.filter(p => {
      const pName = p.name.toLowerCase();
      const pCode = p.code.toLowerCase();
      const pCodeNoHyphen = pCode.replace(/-/g, '');
      return (
        pName.includes(searchStr) || 
        pCode.includes(searchStr) ||
        (searchNoHyphen.length >= 2 && pCodeNoHyphen.includes(searchNoHyphen))
      );
    }).sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Exact match first
      if (aName === searchStr) return -1;
      if (bName === searchStr) return 1;

      // Starts with search string first
      const aStarts = aName.startsWith(searchStr);
      const bStarts = bName.startsWith(searchStr);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Shorter name first (e.g. "MACA GALA KG" before "MACA GALA CAT-1...")
      if (Math.abs(aName.length - bName.length) > 3) {
        return aName.length - bName.length;
      }

      return aName.localeCompare(bName, 'pt-BR');
    }).slice(0, 30); // Expanded limit so items like TOMATE LONGA VIDA KG appear

    setSuggestions(filtered);
    setIsDropdownOpen(filtered.length > 0);

    // Auto-detect measure type if exact match or match without measure suffix
    const exactMatch = PRODUCTS_DATABASE.find(p => {
      const pName = p.name.toLowerCase();
      const pClean = pName.replace(/\s+(kg|un|bj|cx|pt|sc|dz|gf|po)$/i, '');
      const pCode = p.code.toLowerCase();
      const pCodeNoHyphen = pCode.replace(/-/g, '');
      return (
        pName === searchStr || 
        pClean === cleanSearch || 
        pCode === searchStr || 
        (searchNoHyphen.length >= 4 && pCodeNoHyphen === searchNoHyphen)
      );
    });

    if (exactMatch) {
      setMeasureType(exactMatch.type);
    } else {
      setMeasureType('');
    }
  };

  const selectProduct = (name: string, type: string) => {
    setProductName(name);
    setMeasureType(type);
    setIsDropdownOpen(false);
    setSuggestions([]);
    setErrorMsg(null);
  };

  // Keyboard navigation for autocomplete
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < suggestions.length) {
        const selected = suggestions[focusedSuggestionIndex];
        selectProduct(selected.name, selected.type);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Calculation parameters with strict 2 decimal places precision
  const weightDeduction = measureType === 'KG' ? Number((boxes * WEIGHT_PER_BOX).toFixed(2)) : 0;
  const inputNum = totalQuantity ? parseFloat(totalQuantity) || 0 : 0;
  const netWeight = Math.max(0, Number((inputNum - weightDeduction).toFixed(2)));

  // Ensure input only accepts numbers with at most 2 decimal places to the right of the dot
  const handleQuantityChange = (val: string) => {
    // Replace comma with dot for brazilian keyboard compatibility
    const formatted = val.replace(',', '.');

    // Reject invalid characters or more than 2 decimal places
    if (formatted === '' || /^\d+(\.\d{0,2})?$/.test(formatted) || /^\.\d{0,2}$/.test(formatted)) {
      setTotalQuantity(formatted);
      setErrorMsg(null);
    }
  };

  const handleQuantityBlur = () => {
    if (totalQuantity && !isNaN(parseFloat(totalQuantity))) {
      const num = parseFloat(totalQuantity);
      setTotalQuantity(num.toFixed(2));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    const quantityValue = parseFloat(totalQuantity);
    if (isNaN(quantityValue) || quantityValue <= 0) {
      setErrorMsg('Por favor, insira uma quantidade válida maior que zero!');
      return;
    }

    if (measureType === 'KG' && boxes > 0 && netWeight <= 0) {
      setErrorMsg('O peso das caixas excede o peso total do produto! Verifique os valores.');
      return;
    }

    setErrorMsg(null);

    const finalQuantity = measureType === 'KG' 
      ? Number(netWeight.toFixed(2)) 
      : Number(quantityValue.toFixed(2));

    const finalOriginalWeight = measureType === 'KG' && boxes > 0 
      ? Number(quantityValue.toFixed(2)) 
      : undefined;

    // Check for matching product to ensure canonical name and measure type
    const searchClean = productName.trim().toLowerCase();
    const cleanNoSuffix = searchClean.replace(/\s+(kg|un|bj|cx|pt|sc|dz|gf|po)$/i, '');
    const cleanNoHyphen = searchClean.replace(/-/g, '');
    const matched = PRODUCTS_DATABASE.find(p => {
      const pClean = p.name.toLowerCase().replace(/\s+(kg|un|bj|cx|pt|sc|dz|gf|po)$/i, '');
      const pCode = p.code.toLowerCase();
      const pCodeNoHyphen = pCode.replace(/-/g, '');
      return (
        p.name.toLowerCase() === searchClean || 
        pClean === cleanNoSuffix || 
        pCode === searchClean ||
        (cleanNoHyphen.length >= 4 && pCodeNoHyphen === cleanNoHyphen)
      );
    });

    const finalName = matched ? matched.name : productName.trim().toUpperCase();
    const finalType = matched ? matched.type : (measureType || 'UN');

    onAddProduct({
      name: finalName,
      type: finalType,
      quantity: finalQuantity,
      boxes: finalType === 'KG' ? boxes : undefined,
      originalWeight: finalOriginalWeight,
    });

    // Reset Form
    setProductName('');
    setMeasureType('');
    setBoxes(0);
    setTotalQuantity('');
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-slate-50 text-slate-800 rounded-2xl mb-3">
          <Sparkles className="h-6 w-6 text-slate-700 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
          Registro de Produtos
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Hortifrúti & Controle de Peso Líquido
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
          <div className="text-xs font-semibold font-sans leading-snug">{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product Name Autocomplete Field */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 font-sans">
            Nome do Produto
          </label>
          <div className="relative">
            <input
              type="text"
              value={productName}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite para pesquisar..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800 transition text-sm text-slate-800 font-sans"
              required
              autoComplete="off"
            />
            {productName && (
              <button
                type="button"
                onClick={() => handleNameChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 divide-y divide-slate-50">
              {suggestions.map((p, idx) => (
                <div
                  key={`${p.code}-${p.name}`}
                  onClick={() => selectProduct(p.name, p.type)}
                  onMouseEnter={() => setFocusedSuggestionIndex(idx)}
                  className={`px-4 py-2.5 cursor-pointer text-xs font-sans flex items-center justify-between transition ${
                    idx === focusedSuggestionIndex 
                      ? 'bg-slate-100 text-slate-900 font-medium' 
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="font-mono text-[11px] text-slate-400 font-medium shrink-0">
                      {p.code}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold font-mono bg-slate-100 text-slate-600 shrink-0">
                    {p.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Measure Unit Type Field */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 font-sans">
            Tipo de Medida
          </label>
          <input
            type="text"
            value={measureType || 'Selecione um produto'}
            readOnly
            className={`w-full px-4 py-3 rounded-xl border border-slate-100 text-xs font-semibold tracking-wider font-mono ${
              measureType 
                ? 'bg-slate-50 text-slate-800 border-slate-200' 
                : 'bg-slate-50/50 text-slate-400'
            }`}
          />
        </div>

        {/* Box Tare Calculation (Deduction of 1.75 kg) */}
        {measureType === 'KG' && (
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80 transition-all">
            <div className="flex items-center gap-2 mb-2 text-slate-700">
              <PackageOpen className="h-4 w-4 text-slate-600" />
              <label className="text-xs font-bold uppercase tracking-wider font-sans">
                Quantidade de Caixas
              </label>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={boxes === 0 ? '' : boxes}
              onChange={(e) => setBoxes(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0 caixas"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 text-sm font-sans"
            />
            <p className="flex items-start gap-1 text-[10px] text-slate-500 mt-2 font-sans">
              <Info className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
              Cada caixa desconta {WEIGHT_PER_BOX.toFixed(2)} kg do peso bruto.
            </p>
          </div>
        )}

        {/* Quantity (Weight / Units) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 font-sans">
            {measureType === 'KG' ? 'Peso Total Bruto (kg)' : 'Quantidade'}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={totalQuantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onBlur={handleQuantityBlur}
              placeholder={measureType === 'KG' ? '0.00 kg' : '0.00'}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800 transition text-sm text-slate-800 font-sans"
              required
            />
          </div>
        </div>

        {/* Real-time calculated tare breakdown */}
        {measureType === 'KG' && boxes > 0 && parseFloat(totalQuantity) > 0 && (
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-2 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2">
              <Scale className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                Detalhamento do Peso
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 font-sans">Peso Bruto:</span>
              <span>{inputNum.toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 font-sans">Tara Caixas ({boxes}x):</span>
              <span className="text-red-400 font-medium">-{weightDeduction.toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-slate-800 pt-2 font-mono">
              <span className="text-white font-sans font-bold">PESO LÍQUIDO:</span>
              <span className="text-green-400">{netWeight.toFixed(2)} kg</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="pt-3 space-y-3">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition duration-150 cursor-pointer shadow-lg shadow-slate-900/10 hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            Adicionar Produto
          </button>

          <button
            type="button"
            onClick={onViewTable}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition duration-150 cursor-pointer"
          >
            <Table className="h-4 w-4 text-slate-500" />
            Ver Tabela de Produtos
            {registeredCount > 0 && (
              <span className="inline-flex items-center justify-center ml-1.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-950 text-white rounded-full">
                {registeredCount}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
