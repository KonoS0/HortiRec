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
  FileSpreadsheet,
  Table as TableIcon,
  Layers,
  ArrowUpDown,
  ArrowDown01,
  ArrowUp10,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  ShieldAlert,
  FileCheck2,
  AlertTriangle,
  Scale,
  PackageOpen,
  PieChart,
  Percent,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { ProductLaunchEntry, RegisteredProduct } from '../types';
import { PRODUCTS_DATABASE } from '../productsData';
import Barcode from './Barcode';

interface QBNTAuditPanelProps {
  history: ProductLaunchEntry[];
  products: RegisteredProduct[];
  onBack: () => void;
  onViewTable: () => void;
  onViewPeriods: () => void;
}

export default function QBNTAuditPanel({
  history,
  products,
  onBack,
  onViewTable,
  onViewPeriods,
}: QBNTAuditPanelProps) {
  // Date filter (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'NT' | 'QB'>('ALL');
  const [sortBy, setSortBy] = useState<'loss' | 'name'>('loss');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Barcode code lookup
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

  // Filter history records based on date and search
  const filteredLaunches = useMemo(() => {
    return history.filter(item => {
      const itemDateStr = toLocalISODate(item.timestamp);

      if (startDate && itemDateStr < startDate) return false;
      if (endDate && itemDateStr > endDate) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(query);
        const code = getProductCode(item.productName).toLowerCase();
        const matchesCode = code.includes(query);
        if (!matchesName && !matchesCode) return false;
      }

      return true;
    });
  }, [history, startDate, endDate, searchQuery]);

  // Comprehensive Metrics: Total, NT (Nota), QB (Quebra), Regular
  const metrics = useMemo(() => {
    let totalKg = 0;
    let totalUn = 0;

    let ntKg = 0;
    let ntUn = 0;
    let ntCount = 0;

    let qbKg = 0;
    let qbUn = 0;
    let qbCount = 0;

    let regularKg = 0;
    let regularUn = 0;

    filteredLaunches.forEach(item => {
      const productFallback = products.find(p => p.name.toUpperCase() === item.productName.toUpperCase());
      const effectiveClassification = item.classification || productFallback?.classification || '';
      const qty = item.netQuantity;
      if (item.type === 'KG') {
        totalKg += qty;
        if (effectiveClassification === 'NT') {
          ntKg += qty;
          ntCount++;
        } else if (effectiveClassification === 'QB') {
          qbKg += qty;
          qbCount++;
        } else {
          regularKg += qty;
        }
      } else {
        totalUn += qty;
        if (effectiveClassification === 'NT') {
          ntUn += qty;
          ntCount++;
        } else if (effectiveClassification === 'QB') {
          qbUn += qty;
          qbCount++;
        } else {
          regularUn += qty;
        }
      }
    });

    const percentNtKg = totalKg > 0 ? (ntKg / totalKg) * 100 : 0;
    const percentQbKg = totalKg > 0 ? (qbKg / totalKg) * 100 : 0;
    const percentRegularKg = totalKg > 0 ? (regularKg / totalKg) * 100 : 0;

    const percentNtUn = totalUn > 0 ? (ntUn / totalUn) * 100 : 0;
    const percentQbUn = totalUn > 0 ? (qbUn / totalUn) * 100 : 0;
    const percentRegularUn = totalUn > 0 ? (regularUn / totalUn) * 100 : 0;

    return {
      totalKg: Number(totalKg.toFixed(2)),
      totalUn: Number(totalUn.toFixed(2)),
      ntKg: Number(ntKg.toFixed(2)),
      ntUn: Number(ntUn.toFixed(2)),
      ntCount,
      percentNtKg: Number(percentNtKg.toFixed(1)),
      percentNtUn: Number(percentNtUn.toFixed(1)),
      qbKg: Number(qbKg.toFixed(2)),
      qbUn: Number(qbUn.toFixed(2)),
      qbCount,
      percentQbKg: Number(percentQbKg.toFixed(1)),
      percentQbUn: Number(percentQbUn.toFixed(1)),
      regularKg: Number(regularKg.toFixed(2)),
      regularUn: Number(regularUn.toFixed(2)),
      percentRegularKg: Number(percentRegularKg.toFixed(1)),
      percentRegularUn: Number(percentRegularUn.toFixed(1)),
      totalEntries: filteredLaunches.length,
    };
  }, [filteredLaunches]);

  // Grouped products breakdown with occurrences
  const productAuditList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      type: string;
      totalVolume: number;
      qbVolume: number;
      ntVolume: number;
      regularVolume: number;
      totalLaunches: number;
      qbLaunches: number;
      ntLaunches: number;
    }>();

    filteredLaunches.forEach(launch => {
      const key = launch.productName.toUpperCase();
      const existing = map.get(key);
      const productFallback = products.find(p => p.name.toUpperCase() === key);
      const effectiveClassification = launch.classification || productFallback?.classification || '';

      const qty = launch.netQuantity;
      const isNT = effectiveClassification === 'NT';
      const isQB = effectiveClassification === 'QB';

      if (existing) {
        existing.totalVolume = Number((existing.totalVolume + qty).toFixed(2));
        existing.totalLaunches += 1;
        if (isNT) {
          existing.ntVolume = Number((existing.ntVolume + qty).toFixed(2));
          existing.ntLaunches += 1;
        } else if (isQB) {
          existing.qbVolume = Number((existing.qbVolume + qty).toFixed(2));
          existing.qbLaunches += 1;
        } else {
          existing.regularVolume = Number((existing.regularVolume + qty).toFixed(2));
        }
      } else {
        map.set(key, {
          name: launch.productName,
          type: launch.type,
          totalVolume: Number(qty.toFixed(2)),
          qbVolume: isQB ? Number(qty.toFixed(2)) : 0,
          ntVolume: isNT ? Number(qty.toFixed(2)) : 0,
          regularVolume: (!isNT && !isQB) ? Number(qty.toFixed(2)) : 0,
          totalLaunches: 1,
          qbLaunches: isQB ? 1 : 0,
          ntLaunches: isNT ? 1 : 0,
        });
      }
    });

    let list = Array.from(map.values());

    // Filter by classification toggle if active
    if (filterType === 'NT') {
      list = list.filter(item => item.ntVolume > 0);
    } else if (filterType === 'QB') {
      list = list.filter(item => item.qbVolume > 0);
    }

    // Sort
    return list.sort((a, b) => {
      if (sortBy === 'loss') {
        const lossA = a.qbVolume + a.ntVolume;
        const lossB = b.qbVolume + b.ntVolume;
        const diff = sortOrder === 'desc' ? lossB - lossA : lossA - lossB;
        if (diff !== 0) return diff;
        return b.totalVolume - a.totalVolume;
      } else {
        const diff = a.name.localeCompare(b.name, 'pt-BR');
        return sortOrder === 'asc' ? diff : -diff;
      }
    });
  }, [filteredLaunches, filterType, sortBy, sortOrder]);

  // Export Audit CSV
  const handleExportAuditCSV = () => {
    if (productAuditList.length === 0) {
      showToast('Nenhum dado para exportar!');
      return;
    }

    const headers = [
      'Produto',
      'Código de Barras',
      'Unidade',
      'Volume Total',
      'Quebra (QB)',
      '% Quebra',
      'Nota (NT)',
      '% Nota',
      'Saldo Regular',
      'Qtd Lançamentos'
    ];

    const rows = productAuditList.map(item => {
      const code = getProductCode(item.name);
      const qbPct = item.totalVolume > 0 ? ((item.qbVolume / item.totalVolume) * 100).toFixed(1) : '0.0';
      const ntPct = item.totalVolume > 0 ? ((item.ntVolume / item.totalVolume) * 100).toFixed(1) : '0.0';
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${code}"`,
        `"${item.type}"`,
        item.totalVolume.toFixed(2),
        item.qbVolume.toFixed(2),
        `"${qbPct}%"`,
        item.ntVolume.toFixed(2),
        `"${ntPct}%"`,
        item.regularVolume.toFixed(2),
        item.totalLaunches
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_qb_nt_${startDate || 'inicio'}_ate_${endDate || 'fim'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha de auditoria exportada com sucesso!');
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-4 sm:p-6 md:p-8 max-w-full overflow-hidden">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5 sm:pb-6 sm:mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <button
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Novo Registro</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={onViewTable}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <TableIcon className="h-3.5 w-3.5 text-slate-400" />
              <span>Tabela Atual</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={onViewPeriods}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span>Lançamentos & Períodos</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
                Painel de Auditoria • Quebra (QB) & Nota (NT)
              </h2>
              <p className="text-xs text-slate-500">
                Quantificação exata de perdas, devoluções fiscais e aproveitamento de estoque
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Export CSV */}
        <div className="flex items-center gap-2">
          {productAuditList.length > 0 && (
            <button
              onClick={handleExportAuditCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Baixar relatório de auditoria em CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Exportar Auditoria (CSV)
            </button>
          )}
        </div>
      </div>

      {/* Date Filter & Presets */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 md:p-5 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Inputs */}
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

          {/* Quick presets */}
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

        {/* Search Bar & Classification Filter Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-200/60">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por produto ou código..."
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
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial ${
                filterType === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({filteredLaunches.length})
            </button>
            <button
              onClick={() => setFilterType('QB')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial ${
                filterType === 'QB' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
              }`}
            >
              Quebra QB ({metrics.qbCount})
            </button>
            <button
              onClick={() => setFilterType('NT')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial ${
                filterType === 'NT' ? 'bg-green-600 text-white' : 'text-green-700 hover:bg-green-50'
              }`}
            >
              Nota NT ({metrics.ntCount})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {/* Card 1: Total Volume */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Volume Total no Período</span>
              <Scale className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-white mt-1">
              {metrics.totalKg.toFixed(2)} <span className="text-xs font-sans text-slate-300 font-normal">kg</span>
            </div>
            {metrics.totalUn > 0 && (
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                + {metrics.totalUn.toFixed(2)} unidades
              </div>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 font-sans flex items-center justify-between">
            <span>{metrics.totalEntries} pesagens/entradas</span>
            <span className="text-emerald-400 font-semibold">{metrics.percentRegularKg}% regular</span>
          </div>
        </div>

        {/* Card 2: Quebra (QB) */}
        <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-red-700 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                Quebra / Descarte (QB)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-red-100 text-red-800">
                {metrics.percentQbKg}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-red-700 mt-1">
              {metrics.qbKg.toFixed(2)} <span className="text-xs font-sans text-red-600 font-normal">kg</span>
            </div>
            {metrics.qbUn > 0 && (
              <div className="text-xs text-red-600 font-mono mt-0.5">
                + {metrics.qbUn.toFixed(2)} unidades
              </div>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-red-200/60 text-[11px] text-red-700 font-sans flex items-center justify-between">
            <span>{metrics.qbCount} lançamentos marcados</span>
            <span className="font-semibold text-red-800">Perda Operacional</span>
          </div>
        </div>

        {/* Card 3: Nota de Devolução (NT) */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                Nota de Devolução (NT)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                {metrics.percentNtKg}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-800 mt-1">
              {metrics.ntKg.toFixed(2)} <span className="text-xs font-sans text-emerald-700 font-normal">kg</span>
            </div>
            {metrics.ntUn > 0 && (
              <div className="text-xs text-emerald-700 font-mono mt-0.5">
                + {metrics.ntUn.toFixed(2)} unidades
              </div>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-200/60 text-[11px] text-emerald-800 font-sans flex items-center justify-between">
            <span>{metrics.ntCount} lançamentos marcados</span>
            <span className="font-semibold text-emerald-900">Crédito Fiscal</span>
          </div>
        </div>

        {/* Card 4: Saldo Regular Aprovado */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-700 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" />
                Saldo Regular (Livre)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-200 text-slate-800">
                {metrics.percentRegularKg}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-1">
              {metrics.regularKg.toFixed(2)} <span className="text-xs font-sans text-slate-500 font-normal">kg</span>
            </div>
            {metrics.regularUn > 0 && (
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                + {metrics.regularUn.toFixed(2)} unidades
              </div>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] text-slate-600 font-sans flex items-center justify-between">
            <span>Aprovado sem avarias</span>
            <span className="font-semibold text-slate-800">Estoque Líquido</span>
          </div>
        </div>
      </div>

      {/* Visual Proportion Bar */}
      {metrics.totalKg > 0 && (
        <div className="mb-6 bg-slate-50 border border-slate-200/70 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-2 font-sans">
            <span>Composição Proporcional do Período (KG)</span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-800" /> Regular ({metrics.percentRegularKg}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-600" /> Quebra ({metrics.percentQbKg}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-600" /> Nota ({metrics.percentNtKg}%)
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${metrics.percentRegularKg}%` }}
              className="bg-slate-800 transition-all duration-300"
              title={`Regular: ${metrics.regularKg}kg (${metrics.percentRegularKg}%)`}
            />
            <div
              style={{ width: `${metrics.percentQbKg}%` }}
              className="bg-red-600 transition-all duration-300"
              title={`Quebra: ${metrics.qbKg}kg (${metrics.percentQbKg}%)`}
            />
            <div
              style={{ width: `${metrics.percentNtKg}%` }}
              className="bg-green-600 transition-all duration-300"
              title={`Nota: ${metrics.ntKg}kg (${metrics.percentNtKg}%)`}
            />
          </div>
        </div>
      )}

      {/* Table Sorting & Results Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 pt-2 border-t border-slate-100 text-xs">
        <div className="text-slate-500 font-medium">
          Exibindo <strong>{productAuditList.length}</strong> produtos no relatório
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Ordenar:
          </span>
          <button
            onClick={() => {
              if (sortBy === 'loss') {
                setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
              } else {
                setSortBy('loss');
                setSortOrder('desc');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              sortBy === 'loss' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {sortOrder === 'desc' ? <ArrowDown01 className="h-3 w-3" /> : <ArrowUp10 className="h-3 w-3" />}
            <span>Maior Ocorrência (QB+NT)</span>
          </button>
          <button
            onClick={() => {
              if (sortBy === 'name') {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('name');
                setSortOrder('asc');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              sortBy === 'name' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {sortOrder === 'asc' ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpAZ className="h-3 w-3" />}
            <span>Nome A-Z</span>
          </button>
        </div>
      </div>

      {/* Audit Data Table */}
      {productAuditList.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <Info className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nenhum registro para os filtros selecionados</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Ajuste as datas ou selecione outros filtros para exibir a auditoria de quebras e notas de devolução.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                  <th className="px-4 py-3.5">Mercadoria / Código</th>
                  <th className="px-4 py-3.5 text-center w-20">Medida</th>
                  <th className="px-4 py-3.5 text-right w-32">Volume Total</th>
                  <th className="px-4 py-3.5 text-right w-36">Quebra (QB)</th>
                  <th className="px-4 py-3.5 text-right w-36">Nota (NT)</th>
                  <th className="px-4 py-3.5 text-right w-32">Saldo Regular</th>
                  <th className="px-4 py-3.5 text-center w-32">Taxa de Perda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {productAuditList.map((item) => {
                  const lossTotal = item.qbVolume + item.ntVolume;
                  const lossPct = item.totalVolume > 0 ? (lossTotal / item.totalVolume) * 100 : 0;
                  const hasLoss = lossTotal > 0;

                  return (
                    <tr key={item.name} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Barcode */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          <span className="font-bold text-slate-900 font-sans text-sm tracking-tight truncate" title={item.name}>
                            {item.name}
                          </span>
                          <Barcode value={getProductCode(item.name)} height={20} width={1.0} fontSize={8} />
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold font-mono bg-slate-100 text-slate-700 rounded-md">
                          {item.type}
                        </span>
                      </td>

                      {/* Total Volume */}
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-800">
                        {item.totalVolume.toFixed(2)}
                      </td>

                      {/* Quebra (QB) */}
                      <td className="px-4 py-3.5 text-right font-mono">
                        {item.qbVolume > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-red-600">
                              {item.qbVolume.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-red-500">
                              {((item.qbVolume / item.totalVolume) * 100).toFixed(1)}% do produto
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>

                      {/* Nota (NT) */}
                      <td className="px-4 py-3.5 text-right font-mono">
                        {item.ntVolume > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-green-600">
                              {item.ntVolume.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-green-600">
                              {((item.ntVolume / item.totalVolume) * 100).toFixed(1)}% do produto
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>

                      {/* Regular Volume */}
                      <td className="px-4 py-3.5 text-right font-mono text-slate-700 font-medium">
                        {item.regularVolume.toFixed(2)}
                      </td>

                      {/* Overall Loss Rate Pill */}
                      <td className="px-4 py-3.5 text-center font-mono">
                        {hasLoss ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            lossPct > 20
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {lossPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            0.0%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-3">
            {productAuditList.map((item) => {
              const lossTotal = item.qbVolume + item.ntVolume;
              const lossPct = item.totalVolume > 0 ? (lossTotal / item.totalVolume) * 100 : 0;

              return (
                <div
                  key={item.name}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm font-sans tracking-tight">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold font-mono bg-slate-100 text-slate-700 rounded">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Total: <strong>{item.totalVolume.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>

                    {lossPct > 0 ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        lossPct > 20 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {lossPct.toFixed(1)}% afetado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700">
                        100% regular
                      </span>
                    )}
                  </div>

                  <Barcode value={getProductCode(item.name)} height={20} width={1.0} fontSize={8} />

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center">
                    <div>
                      <span className="text-[9px] text-red-600 font-sans font-bold block uppercase">
                        Quebra (QB)
                      </span>
                      <span className="text-xs font-bold text-red-700 font-mono">
                        {item.qbVolume.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-green-600 font-sans font-bold block uppercase">
                        Nota (NT)
                      </span>
                      <span className="text-xs font-bold text-green-700 font-mono">
                        {item.ntVolume.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 font-sans font-semibold block uppercase">
                        Regular
                      </span>
                      <span className="text-xs font-bold text-slate-800 font-mono">
                        {item.regularVolume.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Informative Guidance on Cloud Architecture Security */}
      <div className="mt-8 p-4 bg-slate-50 border border-slate-200/70 rounded-2xl text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <ShieldAlert className="h-4 w-4 text-emerald-600" />
          <span>Informação sobre Segurança para Conexão em Nuvem</span>
        </div>
        <p className="leading-relaxed">
          Os dados quantificados nesta auditoria de Quebra (QB) e Nota (NT) já estão organizados estruturalmente. Quando sua empresa desejar sincronizar múltiplos dispositivos móveis, coletores de dados ou computadores num banco central na nuvem, o acesso é protegido por credenciais de operador, criptografia TLS 1.3 ponta a ponta e regras restritas de segurança a nível de documento, garantindo confidencialidade total das listagens internas da empresa.
        </p>
      </div>

      {/* Floating Status Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-xl shadow-slate-950/25 border border-slate-800 animate-in slide-in-from-bottom-5 duration-350">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium font-sans leading-none">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
