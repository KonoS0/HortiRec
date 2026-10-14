/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react';
import { Plus, Table, AlertCircle, Sparkles, Scale, PackageOpen, CalendarDays } from 'lucide-react';
import { PRODUCTS_DATABASE } from '../productsData';
import { RegisteredProduct } from '../types';

interface ProductFormProps {
  onAddProduct: (
    product: Omit<RegisteredProduct, 'timestamp'>,
    launchMeta?: { inputQuantity: number; tareWeight?: number }
  ) => void;
  onViewTable: () => void;
  onViewPeriodsHistory?: () => void;
  registeredCount: number;
}

const WEIGHT_PER_BOX = 1.75;

export default function ProductForm({
  onAddProduct,
  onViewTable,
  onViewPeriodsHistory,
  registeredCount,
}: ProductFormProps) {
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
    setErrorMsg(null);

    if (!val.trim()) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    const search = val.trim().toLowerCase();
    const searchNoHyphen = search.replace(/-/g, '');

    const filtered = PRODUCTS_DATABASE.filter(p => {
      const pName = p.name.toLowerCase();
      const pCode = p.code.toLowerCase();
      const pCodeNoHyphen = pCode.replace(/-/g, '');

      return (
        pName.includes(search) || 
        pCode.includes(search) ||
        pCodeNoHyphen.includes(searchNoHyphen)
      );
    }).slice(0, 8);

    setSuggestions(filtered);
    setIsDropdownOpen(filtered.length > 0);
  };

  const handleSelectProduct = (product: typeof PRODUCTS_DATABASE[0]) => {
    setProductName(product.name);
    setMeasureType(product.type);
    setIsDropdownOpen(false);
    setSuggestions([]);
    setErrorMsg(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

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
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < suggestions.length) {
        e.preventDefault();
        handleSelectProduct(suggestions[focusedSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Pre-calculate effective net quantity
  const inputNum = parseFloat(totalQuantity) || 0;
  const weightDeduction = measureType === 'KG' ? boxes * WEIGHT_PER_BOX : 0;
  const netWeight = Math.max(0, inputNum - weightDeduction);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!productName.trim()) {
      setErrorMsg('Por favor, digite o nome do produto ou selecione um na lista.');
      return;
    }

    const quantityValue = parseFloat(totalQuantity);
    if (isNaN(quantityValue) || quantityValue <= 0) {
      setErrorMsg('Por favor, informe uma quantidade válida maior que zero.');
      return;
    }

    let finalQuantity = quantityValue;
    let finalOriginalWeight: number | undefined = undefined;

    if (measureType === 'KG') {
      finalOriginalWeight = quantityValue;
      finalQuantity = netWeight;

      if (finalQuantity <= 0) {
        setErrorMsg('O peso líquido não pode ser menor ou igual a zero após o desconto da tara das caixas.');
        return;
      }
    }

    finalQuantity = Number(finalQuantity.toFixed(2));

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

    onAddProduct(
      {
        name: finalName,
        type: finalType,
        quantity: finalQuantity,
        boxes: finalType === 'KG' ? boxes : undefined,
        originalWeight: finalOriginalWeight,
      },
      {
        inputQuantity: quantityValue,
        tareWeight: weightDeduction,
      }
    );

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
          Informe os dados do produto e registre o peso ou unidades
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 bg-red-50/80 border border-red-200/80 rounded-xl flex items-center gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Product Search & Autocomplete */}
        <div className="relative" ref={dropdownRef}>
          <label className="text-xs font-semibold text-slate-700 font-sans block mb-1.5">
            Nome do Produto ou Código
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: TOMATE ou 0001004"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 focus:bg-white transition duration-150"
            autoComplete="off"
            required
          />

          {/* Autocomplete dropdown */}
          {isDropdownOpen && suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {suggestions.map((item, index) => (
                <button
                  type="button"
                  key={`${item.code}-${index}`}
                  onClick={() => handleSelectProduct(item)}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between text-xs transition duration-150 cursor-pointer ${
                    index === focusedSuggestionIndex ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-medium truncate pr-2">{item.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-1.5 py-0.5 font-mono text-[10px] bg-slate-100 text-slate-600 rounded">
                      {item.type}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {item.code}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Measure unit selection */}
        <div>
          <label className="text-xs font-semibold text-slate-700 font-sans block mb-1.5">
            Tipo de Medida
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMeasureType('KG')}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition duration-150 cursor-pointer ${
                measureType === 'KG'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Scale className="h-4 w-4" />
              KG (Quilograma)
            </button>
            <button
              type="button"
              onClick={() => {
                setMeasureType('UN');
                setBoxes(0);
              }}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition duration-150 cursor-pointer ${
                measureType === 'UN'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <PackageOpen className="h-4 w-4" />
              UN (Unidade)
            </button>
          </div>
        </div>

        {/* Boxes and Quantity Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Quantity of Boxes (only active for KG) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 font-sans block mb-1.5">
              Qtd. de Caixas
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={boxes === 0 ? '' : boxes}
              onChange={(e) => setBoxes(Math.max(0, parseInt(e.target.value) || 0))}
              disabled={measureType === 'UN'}
              placeholder="0"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium font-mono transition duration-150 ${
                measureType === 'UN'
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 focus:bg-white'
              }`}
            />
          </div>

          {/* Total input quantity (Gross weight or units) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 font-sans block mb-1.5">
              {measureType === 'KG' ? 'Peso Bruto (KG)' : 'Quantidade (UN)'}
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              value={totalQuantity}
              onChange={(e) => setTotalQuantity(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 focus:bg-white transition duration-150"
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

          {onViewPeriodsHistory && (
            <button
              type="button"
              onClick={onViewPeriodsHistory}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium text-xs rounded-xl transition duration-150 cursor-pointer"
            >
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              Consultar Lançamentos & Períodos
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
