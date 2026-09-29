/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Search,
  X,
  Scale,
  PackageOpen,
  Filter,
  FileSpreadsheet,
  Trash2,
  Table as TableIcon,
  Layers,
  ArrowUpDown,
  ArrowDown01,
  ArrowUp10,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle2,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { ProductLaunchEntry } from '../types';
import { PRODUCTS_DATABASE } from '../productsData';
import Barcode from './Barcode';

interface HistoryAndPeriodsProps {
  history: ProductLaunchEntry[];
  onBack: () => void;
  onViewTable: () => void;
  onDeleteLaunch: (id: string) => void;
  onClearHistory: () => void;
}

export default function HistoryAndPeriods({
  history,
  onBack,
  onViewTable,
  onDeleteLaunch,
  onClearHistory,
}: HistoryAndPeriodsProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'accumulated'>('individual');
  
  // Date filter state (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState<'ALL' | 'KG' | 'UN'>('ALL');

  // Sorting for accumulated tab
  const [accumSortBy, setAccumSortBy] = useState<'quantity' | 'name'>('quantity');
  const [accumSortOrder, setAccumSortOrder] = useState<'desc' | 'asc'>('desc');

  // Confirmation modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    onConfirm: () => {},
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper barcode lookup
  const getProductCode = (name: string): string => {
    const cleanName = name.trim().toUpperCase();
    const match = PRODUCTS_DATABASE.find(p => p.name.toUpperCase() === cleanName);
    if (match) return match.code.replace(/-/g, '');

    const cleanNoSuffix = cleanName.replace(/\s+(KG|UN|BJ|CX|PT|SC|DZ|GF|PO)$/, '');
    const matchWithoutSuffix = PRODUCTS_DATABASE.find(p => {
      const pClean = p.name.toUpperCase().replace(/\s+(KG|UN|BJ|CX|PT|SC|DZ|GF|PO)$/, '');
      return pClean === cleanNoSuffix;
    });
    if (matchWithoutSuffix) return matchWithoutSuffix.code.replace(/-/g, '');

    return '0000000';
  };

  // Convert timestamp to local YYYY-MM-DD string
  const toLocalISODate = (ts: number): string => {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Quick Date Range Helpers
  const setQuickFilter = (preset: 'today' | 'yesterday' | 'last7' | 'month' | 'all') => {
    const today = new Date();
    const todayStr = toLocalISODate(today.getTime());

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalISODate(yesterday.getTime());
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === 'last7') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      setStartDate(toLocalISODate(past7.getTime()));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toLocalISODate(firstDay.getTime()));
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // 1. Filter Individual Launches according to Date Range, Search Query, and Unit Filter
  const filteredLaunches = useMemo(() => {
    return history.filter(item => {
      const itemDateStr = toLocalISODate(item.timestamp);

      // Start Date check
      if (startDate && itemDateStr < startDate) {
        return false;
      }

      // End Date check
      if (endDate && itemDateStr > endDate) {
        return false;
      }

      // Unit filter check
      if (unitFilter !== 'ALL' && item.type !== unitFilter) {
        return false;
      }

      // Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(query);
        const code = getProductCode(item.productName).toLowerCase();
        const matchesCode = code.includes(query);
        if (!matchesName && !matchesCode) return false;
      }

      return true;
    });
  }, [history, startDate, endDate, unitFilter, searchQuery]);

  // 2. Compute Accumulated Products based on the Filtered Launches of the Period
  const accumulatedProducts = useMemo(() => {
    const map = new Map<string, {
      name: string;
      type: string;
      totalNetQuantity: number;
      totalInputQuantity: number;
      totalBoxes: number;
      totalTare: number;
      launchCount: number;
      latestTimestamp: number;
      classification?: 'NT' | 'QB' | '';
    }>();

    filteredLaunches.forEach(launch => {
      const key = launch.productName.toUpperCase();
      const existing = map.get(key);

      if (existing) {
        existing.totalNetQuantity = Number((existing.totalNetQuantity + launch.netQuantity).toFixed(2));
        existing.totalInputQuantity = Number((existing.totalInputQuantity + launch.inputQuantity).toFixed(2));
        existing.totalBoxes += (launch.boxes || 0);
        existing.totalTare = Number((existing.totalTare + (launch.tareWeight || 0)).toFixed(2));
        existing.launchCount += 1;
        if (launch.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = launch.timestamp;
        }
        if (launch.classification) {
          existing.classification = launch.classification;
        }
      } else {
        map.set(key, {
          name: launch.productName,
          type: launch.type,
          totalNetQuantity: Number(launch.netQuantity.toFixed(2)),
          totalInputQuantity: Number(launch.inputQuantity.toFixed(2)),
          totalBoxes: launch.boxes || 0,
          totalTare: Number((launch.tareWeight || 0).toFixed(2)),
          launchCount: 1,
          latestTimestamp: launch.timestamp,
          classification: launch.classification,
        });
      }
    });

    const list = Array.from(map.values());

    // Sort accumulated products
    return list.sort((a, b) => {
      if (accumSortBy === 'quantity') {
        const diff = accumSortOrder === 'desc' 
          ? b.totalNetQuantity - a.totalNetQuantity 
          : a.totalNetQuantity - b.totalNetQuantity;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'pt-BR');
      } else {
        const diff = a.name.localeCompare(b.name, 'pt-BR');
        return accumSortOrder === 'asc' ? diff : -diff;
      }
    });
  }, [filteredLaunches, accumSortBy, accumSortOrder]);

  // Overall Statistics for the Filtered Period
  const periodStats = useMemo(() => {
    let totalKg = 0;
    let totalUn = 0;
    let totalBoxes = 0;
    let totalTare = 0;

    filteredLaunches.forEach(item => {
      if (item.type === 'KG') {
        totalKg += item.netQuantity;
      } else {
        totalUn += item.netQuantity;
      }
      if (item.boxes) {
        totalBoxes += item.boxes;
      }
      if (item.tareWeight) {
        totalTare += item.tareWeight;
      }
    });

    return {
      launchCount: filteredLaunches.length,
      accumulatedItemCount: accumulatedProducts.length,
      totalKg: Number(totalKg.toFixed(2)),
      totalUn: Number(totalUn.toFixed(2)),
      totalBoxes,
      totalTare: Number(totalTare.toFixed(2)),
    };
  }, [filteredLaunches, accumulatedProducts]);

  // Delete an individual launch
  const handleDeleteLaunchClick = (id: string, name: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Excluir Lançamento Individual',
      message: `Tem certeza que deseja excluir este lançamento de "${name}"? O peso deste registro será abatido das somas acumuladas.`,
      confirmText: 'Excluir',
      onConfirm: () => {
        onDeleteLaunch(id);
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        showToast('Lançamento excluído com sucesso!');
      },
    });
  };

  // Export CSV of the filtered launches
  const handleExportCSV = () => {
    if (filteredLaunches.length === 0) {
      showToast('Nenhum dado encontrado para o período selecionado!');
      return;
    }

    const headers = [
      'Data e Hora',
      'Produto',
      'Código de Barras',
      'Medida',
      'Quantidade/Peso Bruto',
      'Caixas',
      'Tara (kg)',
      'Quantidade Líquida',
      'Classificação'
    ];

    const rows = filteredLaunches.map(item => {
      const dt = new Date(item.timestamp).toLocaleString('pt-BR');
      const code = getProductCode(item.productName);
      return [
        `"${dt}"`,
        `"${item.productName.replace(/"/g, '""')}"`,
        `"${code}"`,
        `"${item.type}"`,
        item.inputQuantity.toFixed(2),
        item.boxes || 0,
        (item.tareWeight || 0).toFixed(2),
        item.netQuantity.toFixed(2),
        `"${item.classification || ''}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `lancamentos_${startDate || 'inicio'}_ate_${endDate || 'fim'}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha CSV exportada com sucesso!');
  };

  // Clear date filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setUnitFilter('ALL');
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-5 md:p-8">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Novo Registro
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={onViewTable}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <TableIcon className="h-3.5 w-3.5 text-slate-400" />
              Tabela Atual
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
                Lançamentos & Períodos
              </h2>
              <p className="text-xs text-slate-500">
                Consulte cada lançamento individual e as somas acumuladas por intervalo de datas
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Export CSV */}
        <div className="flex items-center gap-2">
          {filteredLaunches.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Baixar planilha CSV com os dados filtrados"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Date Range Selector Box */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 md:p-5 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 font-sans uppercase tracking-wider">
                De:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 font-sans uppercase tracking-wider">
                Até:
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
              >
                Limpar datas
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Atalhos:
            </span>
            <button
              onClick={() => setQuickFilter('today')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Hoje
            </button>
            <button
              onClick={() => setQuickFilter('yesterday')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              title="Ver apenas os lançamentos de ontem"
            >
              Ontem
            </button>
            <button
              onClick={() => setQuickFilter('last7')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => setQuickFilter('month')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Mês Atual
            </button>
            <button
              onClick={() => setQuickFilter('all')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Todos
            </button>
          </div>
        </div>

        {/* Search and Unit Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-200/60">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome do produto ou código de barras..."
              className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-medium w-full sm:w-auto">
            <button
              onClick={() => setUnitFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial ${
                unitFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas Medidas
            </button>
            <button
              onClick={() => setUnitFilter('KG')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial ${
                unitFilter === 'KG' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apenas KG
            </button>
            <button
              onClick={() => setUnitFilter('UN')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial ${
                unitFilter === 'UN' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apenas UN
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards for the Selected Period */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
            Lançamentos no Período
          </span>
          <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
            {periodStats.launchCount} <span className="text-xs font-sans text-slate-400 font-normal">({periodStats.accumulatedItemCount} produtos)</span>
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
            Peso Líquido Acumulado
          </span>
          <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5 block">
            {periodStats.totalKg.toFixed(2)} kg
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
            Unidades Acumuladas
          </span>
          <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
            {periodStats.totalUn.toFixed(2)} un
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
            Caixas e Tara no Período
          </span>
          <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
            {periodStats.totalBoxes} cx <span className="text-xs text-red-500 font-normal">(-{periodStats.totalTare.toFixed(2)}kg)</span>
          </span>
        </div>
      </div>

      {/* Main Tabs Navigation: Lançamentos Individuais vs Lançamentos Acumulados */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer font-sans ${
              activeTab === 'individual'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Lançamentos Individuais</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
              activeTab === 'individual' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {filteredLaunches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('accumulated')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer font-sans ${
              activeTab === 'accumulated'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Lançamentos Acumulados (Período)</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
              activeTab === 'accumulated' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {accumulatedProducts.length}
            </span>
          </button>
        </div>

        {/* Tab 2 Sorting Toolbar if active */}
        {activeTab === 'accumulated' && accumulatedProducts.length > 0 && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Ordenar:
            </span>
            <button
              onClick={() => {
                if (accumSortBy === 'quantity') {
                  setAccumSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                } else {
                  setAccumSortBy('quantity');
                  setAccumSortOrder('desc');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                accumSortBy === 'quantity' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {accumSortOrder === 'desc' ? <ArrowDown01 className="h-3 w-3" /> : <ArrowUp10 className="h-3 w-3" />}
              <span>Peso / Qtd</span>
            </button>

            <button
              onClick={() => {
                if (accumSortBy === 'name') {
                  setAccumSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                } else {
                  setAccumSortBy('name');
                  setAccumSortOrder('asc');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                accumSortBy === 'name' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {accumSortOrder === 'asc' ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpAZ className="h-3 w-3" />}
              <span>Nome A-Z</span>
            </button>
          </div>
        )}
      </div>

      {/* CONTENT AREA: TAB 1 - LANÇAMENTOS INDIVIDUAIS */}
      {activeTab === 'individual' && (
        <>
          {filteredLaunches.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">Nenhum lançamento individual encontrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Não há registros individuais gravados para os filtros ou período de datas selecionados.
              </p>
              {(startDate || endDate || searchQuery || unitFilter !== 'ALL') && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Limpar Filtros e Ver Todos
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table: Lançamentos Individuais */}
              <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-xs">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                      <th className="px-4 py-3.5 w-36">Data & Hora</th>
                      <th className="px-4 py-3.5">Produto / Código de Barras</th>
                      <th className="px-4 py-3.5 text-center w-20">Medida</th>
                      <th className="px-4 py-3.5 text-right w-36">Bruto de Entrada</th>
                      <th className="px-4 py-3.5 text-center w-36">Caixas & Tara</th>
                      <th className="px-4 py-3.5 text-right w-36">Líquido Registrado</th>
                      <th className="px-4 py-3.5 text-center w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredLaunches.map((item) => {
                      const dateObj = new Date(item.timestamp);
                      const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });
                      const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Exact Date & Time */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 font-mono text-[11px]">
                                {formattedDate}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formattedTime}
                              </span>
                            </div>
                          </td>

                          {/* Product Name & Barcode */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1 max-w-[280px]">
                              <span className="font-bold text-slate-900 font-sans text-sm tracking-tight truncate" title={item.productName}>
                                {item.productName}
                              </span>
                              <Barcode value={getProductCode(item.productName)} height={22} width={1.1} fontSize={8} />
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold font-mono bg-slate-100 text-slate-700 rounded-md">
                              {item.type}
                            </span>
                          </td>

                          {/* Gross Input */}
                          <td className="px-4 py-3.5 text-right font-mono">
                            <span className="text-slate-600 font-medium">
                              {item.inputQuantity.toFixed(2)}
                            </span>
                          </td>

                          {/* Boxes & Tara */}
                          <td className="px-4 py-3.5 text-center">
                            {item.boxes && item.boxes > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold text-slate-800 font-sans text-[11px]">
                                  {item.boxes} {item.boxes === 1 ? 'cx' : 'cxs'}
                                </span>
                                <span className="text-[10px] text-red-500 font-mono">
                                  -{(item.tareWeight || 0).toFixed(2)} kg
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>

                          {/* Net Quantity */}
                          <td className="px-4 py-3.5 text-right font-mono">
                            <span className="font-bold text-emerald-700 text-sm">
                              {item.netQuantity.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1 font-sans">
                              {item.type.toLowerCase()}
                            </span>
                          </td>

                          {/* Delete Action */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleDeleteLaunchClick(item.id, item.productName)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir este lançamento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards: Lançamentos Individuais */}
              <div className="block md:hidden space-y-3">
                {filteredLaunches.map((item) => {
                  const dateObj = new Date(item.timestamp);
                  const formattedDate = dateObj.toLocaleDateString('pt-BR');
                  const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm font-sans tracking-tight leading-snug">
                            {item.productName}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono font-semibold text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {formattedDate} às {formattedTime}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold font-mono bg-slate-100 text-slate-700 rounded">
                              {item.type}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLaunchClick(item.id, item.productName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <Barcode value={getProductCode(item.productName)} height={22} width={1.1} fontSize={8} />

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center">
                        <div>
                          <span className="text-[9px] text-slate-400 font-sans font-semibold block uppercase">
                            Bruto
                          </span>
                          <span className="text-xs font-bold text-slate-700 font-mono">
                            {item.inputQuantity.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-sans font-semibold block uppercase">
                            Caixas / Tara
                          </span>
                          <span className="text-xs font-semibold text-slate-700 font-mono">
                            {item.boxes ? `${item.boxes}cx (-${(item.tareWeight || 0).toFixed(2)})` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-600 font-sans font-bold block uppercase">
                            Líquido
                          </span>
                          <span className="text-xs font-bold text-emerald-700 font-mono">
                            {item.netQuantity.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* CONTENT AREA: TAB 2 - LANÇAMENTOS ACUMULADOS NO PERÍODO */}
      {activeTab === 'accumulated' && (
        <>
          {accumulatedProducts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Layers className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">Nenhum acumulado para este período</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Selecione outro período de datas ou limpe os filtros para visualizar a soma acumulada de mercadorias.
              </p>
              {(startDate || endDate || searchQuery || unitFilter !== 'ALL') && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table: Lançamentos Acumulados */}
              <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-xs">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                      <th className="px-4 py-3.5">Produto / Código de Barras</th>
                      <th className="px-4 py-3.5 text-center w-24">Medida</th>
                      <th className="px-4 py-3.5 text-center w-36">Lançamentos</th>
                      <th className="px-4 py-3.5 text-center w-36">Caixas Totais</th>
                      <th className="px-4 py-3.5 text-right w-44">Quantidade Acumulada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {accumulatedProducts.map((p) => (
                      <tr key={p.name} className="hover:bg-slate-50/60 transition-colors">
                        {/* Product & Barcode */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1.5 max-w-[320px]">
                            <span className="font-bold text-slate-900 font-sans text-sm tracking-tight">
                              {p.name}
                            </span>
                            <Barcode value={getProductCode(p.name)} height={24} width={1.1} fontSize={8} />
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-bold font-mono bg-slate-100 text-slate-700 rounded-md">
                            {p.type}
                          </span>
                        </td>

                        {/* Frequency / Launch Count */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 font-sans">
                            {p.launchCount} {p.launchCount === 1 ? 'lançamento' : 'lançamentos'}
                          </span>
                        </td>

                        {/* Total Boxes & Tara */}
                        <td className="px-4 py-4 text-center">
                          {p.totalBoxes > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold text-slate-800 font-sans text-xs">
                                {p.totalBoxes} cx
                              </span>
                              <span className="text-[10px] text-red-500 font-mono">
                                Tara: -{p.totalTare.toFixed(2)} kg
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>

                        {/* Total Net Quantity */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-950 font-mono text-base">
                              {p.totalNetQuantity.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {p.type === 'KG' ? 'kg líquidos' : 'unidades'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards: Lançamentos Acumulados */}
              <div className="block md:hidden space-y-3">
                {accumulatedProducts.map((p) => (
                  <div
                    key={p.name}
                    className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm font-sans tracking-tight">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold font-mono bg-slate-100 text-slate-700 rounded">
                            {p.type}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {p.launchCount} {p.launchCount === 1 ? 'lançamento' : 'lançamentos no período'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Barcode value={getProductCode(p.name)} height={22} width={1.1} fontSize={8} />

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block uppercase">
                          Caixas / Tara
                        </span>
                        <span className="text-xs font-semibold text-slate-700 font-mono">
                          {p.totalBoxes > 0 ? `${p.totalBoxes} cx (-${p.totalTare.toFixed(2)}kg)` : 'Sem caixas'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-sans block uppercase">
                          Total Acumulado
                        </span>
                        <span className="text-base font-bold text-emerald-700 font-mono">
                          {p.totalNetQuantity.toFixed(2)} {p.type.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-150 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl shrink-0 bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  {modalConfig.title}
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-1.5 leading-relaxed">
                  {modalConfig.message}
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-6">
              <button
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={modalConfig.onConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-xl shadow-slate-950/25 border border-slate-800 animate-in slide-in-from-bottom-5 duration-350">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium font-sans leading-none">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
