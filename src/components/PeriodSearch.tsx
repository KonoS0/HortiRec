/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Search,
  ArrowLeft,
  Download,
  Printer,
  Undo2,
  Package,
  Scale,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Clock,
  History,
  Tag,
  Hash,
  Sparkles,
} from 'lucide-react';
import { LaunchRecord, RegisteredProduct } from '../types';
import {
  getAllLaunches,
  undoLaunchRecord,
  formatLocalDate,
  getTodayDateString,
  TABLE_DATE_KEY,
} from '../launchesDb';

interface PeriodSearchProps {
  onBack: () => void;
  onNavigateToForm: () => void;
  onNavigateToTable: () => void;
  activeProducts: RegisteredProduct[];
  onSyncActiveProducts: (updatedList: RegisteredProduct[]) => void;
  currentTableDate: string;
}

interface ProductCumulativeSummary {
  code: string;
  name: string;
  type: string;
  totalQuantity: number;
  totalBoxes: number;
  totalOriginalWeight: number;
  launchCount: number;
  averagePerLaunch: number;
  launches: LaunchRecord[];
}

export default function PeriodSearch({
  onBack,
  onNavigateToForm,
  onNavigateToTable,
  activeProducts,
  onSyncActiveProducts,
  currentTableDate,
}: PeriodSearchProps) {
  // Database launches state
  const [launches, setLaunches] = useState<LaunchRecord[]>([]);

  // Period filters
  const today = getTodayDateString();

  // Default to 1st of current month or last 7 days
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    // 1st of current month
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(today);

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'KG' | 'UN'>('ALL');
  const [activeTab, setActiveTab] = useState<'cumulative' | 'detailed'>('cumulative');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Modal / Toast state
  const [undoSuccessToast, setUndoSuccessToast] = useState<string | null>(null);
  const [confirmUndoModal, setConfirmUndoModal] = useState<{
    isOpen: boolean;
    launch: LaunchRecord | null;
  }>({
    isOpen: false,
    launch: null,
  });

  // Load launches from internal database
  const loadDatabase = () => {
    const data = getAllLaunches();
    setLaunches(data);
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  const triggerToast = (msg: string) => {
    setUndoSuccessToast(msg);
    setTimeout(() => {
      setUndoSuccessToast(null);
    }, 4000);
  };

  // Preset Date range shortcuts
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'prevMonth' | 'all') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'today') {
      const t = getTodayDateString();
      setStartDate(t);
      setEndDate(t);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'last7') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setStartDate(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
      setEndDate(today);
    } else if (preset === 'last30') {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      setStartDate(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
      setEndDate(today);
    } else if (preset === 'thisMonth') {
      const firstDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      setStartDate(firstDay);
      setEndDate(today);
    } else if (preset === 'prevMonth') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-01`);
      setEndDate(`${lastDayOfPrev.getFullYear()}-${pad(lastDayOfPrev.getMonth() + 1)}-${pad(lastDayOfPrev.getDate())}`);
    } else if (preset === 'all') {
      // Find earliest launch or fallback to 2026-01-01
      if (launches.length > 0) {
        const sorted = [...launches].sort((a, b) => a.date.localeCompare(b.date));
        setStartDate(sorted[0].date);
      } else {
        setStartDate('2026-01-01');
      }
      setEndDate(today);
    }
  };

  // Filter launches within selected date range
  const filteredLaunches = useMemo(() => {
    return launches.filter((launch) => {
      // Date filter
      if (startDate && launch.date < startDate) return false;
      if (endDate && launch.date > endDate) return false;

      // Type filter
      if (typeFilter !== 'ALL' && launch.type !== typeFilter) return false;

      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const qNoHyphen = q.replace(/-/g, '');
        const matchName = launch.name.toLowerCase().includes(q);
        const matchCode = launch.code.toLowerCase().includes(q) || (qNoHyphen.length >= 2 && launch.code.replace(/-/g, '').includes(qNoHyphen));
        if (!matchName && !matchCode) return false;
      }

      return true;
    });
  }, [launches, startDate, endDate, typeFilter, searchTerm]);

  // Active (non-undone) launches for calculations
  const activePeriodLaunches = useMemo(() => {
    return filteredLaunches.filter(l => !l.undone);
  }, [filteredLaunches]);

  // Aggregate cumulative totals grouped by product
  const cumulativeSummaries = useMemo<ProductCumulativeSummary[]>(() => {
    const map = new Map<string, ProductCumulativeSummary>();

    activePeriodLaunches.forEach((launch) => {
      const key = launch.name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          code: launch.code.replace(/-/g, ''),
          name: launch.name,
          type: launch.type,
          totalQuantity: 0,
          totalBoxes: 0,
          totalOriginalWeight: 0,
          launchCount: 0,
          averagePerLaunch: 0,
          launches: [],
        });
      }

      const item = map.get(key)!;
      item.totalQuantity = Number((item.totalQuantity + launch.quantity).toFixed(2));
      item.totalBoxes += launch.boxes || 0;
      item.totalOriginalWeight = Number((item.totalOriginalWeight + (launch.originalWeight || 0)).toFixed(2));
      item.launchCount += 1;
      item.launches.push(launch);
    });

    // Calculate averages and sort by total quantity descending
    const list = Array.from(map.values()).map(item => ({
      ...item,
      averagePerLaunch: item.launchCount > 0 ? Number((item.totalQuantity / item.launchCount).toFixed(2)) : 0,
      launches: item.launches.sort((a, b) => b.timestamp - a.timestamp),
    }));

    return list.sort((a, b) => b.totalQuantity - a.totalQuantity || a.name.localeCompare(b.name, 'pt-BR'));
  }, [activePeriodLaunches]);

  // Period overall KPIs
  const kpis = useMemo(() => {
    let totalKg = 0;
    let totalUn = 0;
    let totalBoxes = 0;

    activePeriodLaunches.forEach((l) => {
      if (l.type === 'KG') {
        totalKg += l.quantity;
      } else {
        totalUn += l.quantity;
      }
      totalBoxes += l.boxes || 0;
    });

    return {
      launchCount: activePeriodLaunches.length,
      uniqueProducts: cumulativeSummaries.length,
      totalKg: Number(totalKg.toFixed(2)),
      totalUn: Number(totalUn.toFixed(2)),
      totalBoxes,
    };
  }, [activePeriodLaunches, cumulativeSummaries]);

  // Handle undo of an individual launch
  const handleConfirmUndo = (launch: LaunchRecord) => {
    const undone = undoLaunchRecord(launch.id);
    if (!undone) {
      triggerToast('Este lançamento já foi desfeito ou não pôde ser revertido.');
      setConfirmUndoModal({ isOpen: false, launch: null });
      return;
    }

    // Refresh internal database state
    loadDatabase();

    // Check if this launch affects the currently active table
    // (matches product name and date matches current table date)
    const existingIdx = activeProducts.findIndex(
      p => p.name.toUpperCase() === launch.name.toUpperCase()
    );

    if (existingIdx >= 0) {
      const currentProd = activeProducts[existingIdx];
      const newQuantity = Number((currentProd.quantity - launch.quantity).toFixed(2));
      const newBoxes = Math.max(0, (currentProd.boxes || 0) - (launch.boxes || 0));
      const newOriginalWeight = (currentProd.originalWeight || 0) - (launch.originalWeight || 0);

      let updatedList = [...activeProducts];
      if (newQuantity <= 0.001) {
        // Remove item completely if reduced to zero
        updatedList = updatedList.filter((_, idx) => idx !== existingIdx);
      } else {
        updatedList[existingIdx] = {
          ...currentProd,
          quantity: newQuantity,
          boxes: newBoxes > 0 ? newBoxes : undefined,
          originalWeight: newOriginalWeight > 0 ? Number(newOriginalWeight.toFixed(2)) : undefined,
        };
      }
      onSyncActiveProducts(updatedList);
    }

    triggerToast(
      `Lançamento de ${launch.quantity.toFixed(2)} ${launch.type} de "${launch.name}" desfeito com sucesso!`
    );
    setConfirmUndoModal({ isOpen: false, launch: null });
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (cumulativeSummaries.length === 0) {
      triggerToast('Não há dados no período selecionado para exportar.');
      return;
    }

    const headers = [
      'Código',
      'Nome do Produto',
      'Unidade',
      'Quantidade Acumulada',
      'Total Caixas',
      'Peso Bruto (kg)',
      'Nº de Lançamentos',
      'Média por Lançamento',
    ];

    const rows = cumulativeSummaries.map(item => [
      item.code,
      `"${item.name.replace(/"/g, '""')}"`,
      item.type,
      item.totalQuantity.toFixed(2).replace('.', ','),
      item.totalBoxes,
      item.totalOriginalWeight > 0 ? item.totalOriginalWeight.toFixed(2).replace('.', ',') : '',
      item.launchCount,
      item.averagePerLaunch.toFixed(2).replace('.', ','),
    ]);

    // UTF-8 BOM for correct accents in Microsoft Excel
    const csvContent =
      '\uFEFF' +
      `Período de Referência: ${formatLocalDate(startDate)} até ${formatLocalDate(endDate)}\n` +
      `Total de Lançamentos: ${kpis.launchCount}; Total KG: ${kpis.totalKg.toFixed(2).replace('.', ',')}; Total UN: ${kpis.totalUn.toFixed(2).replace('.', ',')}\n\n` +
      headers.join(';') +
      '\n' +
      rows.map(r => r.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HortiBar_Acumulado_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast('Relatório CSV exportado com sucesso!');
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Toast Notification */}
      {undoSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-2 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="font-sans font-medium">{undoSuccessToast}</span>
          <button
            onClick={() => setUndoSuccessToast(null)}
            className="text-slate-400 hover:text-white ml-2 p-1"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-5 md:p-6 print:shadow-none print:border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={onBack}
                className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer print:hidden"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Voltar
              </button>
              <span className="text-slate-300 print:hidden">•</span>
              <button
                onClick={onNavigateToForm}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition print:hidden"
              >
                Formulário de Registro
              </button>
              <span className="text-slate-300 print:hidden">•</span>
              <button
                onClick={onNavigateToTable}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition print:hidden"
              >
                Tabela do Lote Atual
              </button>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
              <History className="h-6 w-6 text-slate-700" />
              Consulta e Somas Cumulativas por Período
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Base de dados interna que registra e acumula todos os lançamentos entre datas selecionadas.
            </p>
          </div>

          {/* Quick actions: Print & Export */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              title="Exportar planilha compatível com Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Excel (CSV)</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-md shadow-slate-900/10"
              title="Imprimir relatório analítico"
            >
              <Printer className="h-4 w-4 text-slate-300" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Search Controls */}
        <div className="space-y-4 print:hidden">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Período Rápido:
            </span>
            {[
              { id: 'today', label: 'Hoje' },
              { id: 'yesterday', label: 'Ontem' },
              { id: 'last7', label: 'Últimos 7 dias' },
              { id: 'last30', label: 'Últimos 30 dias' },
              { id: 'thisMonth', label: 'Este Mês' },
              { id: 'prevMonth', label: 'Mês Anterior' },
              { id: 'all', label: 'Todo o Histórico' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyDatePreset(preset.id as any)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Picker row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Data Inicial
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Data Final
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </div>

            {/* Product text search */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Buscar Produto ou Código
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nome ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Tipo de Medida
              </label>
              <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
                {(['ALL', 'KG', 'UN'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                      typeFilter === t
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'ALL' ? 'Todos' : t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Current Active Table notice if past date */}
        {currentTableDate < today && (
          <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 print:hidden">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Lote Ativo Retido ({formatLocalDate(currentTableDate, 'weekday')}):</span> A data da tabela atual foi preservada com o dia dos lançamentos anteriores e não atualiza para hoje automaticamente enquanto houver itens registrados nela.
            </div>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider font-sans">
              Lançamentos
            </span>
            <History className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {kpis.launchCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
            registros no período filtrado
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider font-sans">
              Total em Quilos (KG)
            </span>
            <Scale className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {kpis.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-semibold text-slate-500 ml-1">kg</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
            peso líquido acumulado
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider font-sans">
              Total em Unidades (UN)
            </span>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {kpis.totalUn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-semibold text-slate-500 ml-1">un</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
            unidades somadas
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider font-sans">
              Produtos Únicos
            </span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {kpis.uniqueProducts}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
            {kpis.totalBoxes > 0 ? `${kpis.totalBoxes} caixas descontadas` : 'itens distintos movimentados'}
          </p>
        </div>
      </div>

      {/* Main Content: Tabs for Cumulative vs Detailed List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-5 md:p-6">
        {/* Tab switcher */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('cumulative')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'cumulative'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Soma Cumulativa por Produto ({cumulativeSummaries.length})
            </button>
            <button
              onClick={() => setActiveTab('detailed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'detailed'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Todos os Lançamentos Detalhados ({filteredLaunches.length})
            </button>
          </div>

          <div className="text-xs text-slate-500 font-sans">
            Período: <strong className="text-slate-800">{formatLocalDate(startDate)}</strong> até{' '}
            <strong className="text-slate-800">{formatLocalDate(endDate)}</strong>
          </div>
        </div>

        {/* TAB 1: CUMULATIVE SUMMARY VIEW */}
        {activeTab === 'cumulative' && (
          <div>
            {cumulativeSummaries.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <AlertCircle className="h-9 w-9 text-slate-400 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-700">Nenhum lançamento encontrado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Não há registros para o período e filtros selecionados. Tente ajustar as datas inicial e final acima.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans bg-slate-50/50">
                      <th className="py-3 px-3 rounded-l-xl">Código</th>
                      <th className="py-3 px-3">Produto</th>
                      <th className="py-3 px-3 text-center">Unidade</th>
                      <th className="py-3 px-3 text-right">Soma Cumulativa</th>
                      <th className="py-3 px-3 text-center">Caixas</th>
                      <th className="py-3 px-3 text-center">Lançamentos</th>
                      <th className="py-3 px-3 text-right">Média / Lançamento</th>
                      <th className="py-3 px-3 text-center rounded-r-xl print:hidden">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-sans">
                    {cumulativeSummaries.map((item) => {
                      const isExpanded = expandedProduct === item.name;

                      return (
                        <tr
                          key={item.name}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Code */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px]">
                              {item.code}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {item.name}
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              {item.type}
                            </span>
                          </td>

                          {/* Cumulative Total */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                            {item.totalQuantity.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            <span className="text-[11px] font-normal text-slate-500">
                              {item.type}
                            </span>
                          </td>

                          {/* Boxes */}
                          <td className="py-3 px-3 text-center font-mono text-slate-600">
                            {item.totalBoxes > 0 ? (
                              <span className="font-semibold text-slate-800">
                                {item.totalBoxes} cx
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Launches count */}
                          <td className="py-3 px-3 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                              {item.launchCount}x
                            </span>
                          </td>

                          {/* Average */}
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {item.averagePerLaunch.toFixed(2)}{' '}
                            <span className="text-[10px] text-slate-400">{item.type}</span>
                          </td>

                          {/* Drill-down / Details toggle */}
                          <td className="py-3 px-3 text-center print:hidden">
                            <button
                              onClick={() =>
                                setExpandedProduct(isExpanded ? null : item.name)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Ver Detalhes'}</span>
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Drilldown modal or sub-table if product expanded */}
            {expandedProduct && (
              <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-slate-500" />
                    Lançamentos Individuais de: <span className="text-slate-900">{expandedProduct}</span>
                  </h4>
                  <button
                    onClick={() => setExpandedProduct(null)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Fechar
                  </button>
                </div>

                <div className="space-y-1.5">
                  {cumulativeSummaries
                    .find(c => c.name === expandedProduct)
                    ?.launches.map(launch => (
                      <div
                        key={launch.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 text-xs gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] font-semibold text-slate-600">
                            {formatLocalDate(launch.date)} às{' '}
                            {new Date(launch.timestamp).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            +{launch.quantity.toFixed(2)} {launch.type}
                          </span>
                          {launch.boxes && launch.boxes > 0 && (
                            <span className="text-[10px] text-slate-500">
                              ({launch.boxes} caixas / Bruto: {launch.originalWeight?.toFixed(2)} kg)
                            </span>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={() => setConfirmUndoModal({ isOpen: true, launch })}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition cursor-pointer"
                          >
                            <Undo2 className="h-3 w-3" />
                            Desfazer este Lançamento
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DETAILED CHRONOLOGICAL AUDIT LIST */}
        {activeTab === 'detailed' && (
          <div>
            {filteredLaunches.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <AlertCircle className="h-9 w-9 text-slate-400 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-700">Nenhum lançamento registrado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Não encontramos nenhum lançamento para os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans bg-slate-50/50">
                      <th className="py-3 px-3 rounded-l-xl">Data / Hora</th>
                      <th className="py-3 px-3">Código</th>
                      <th className="py-3 px-3">Produto</th>
                      <th className="py-3 px-3 text-right">Quantidade</th>
                      <th className="py-3 px-3 text-center">Caixas / Tara</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center rounded-r-xl print:hidden">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-sans">
                    {filteredLaunches
                      .slice()
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((launch) => (
                        <tr
                          key={launch.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            launch.undone ? 'opacity-50 line-through' : ''
                          }`}
                        >
                          {/* Date and Time */}
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            <div>{formatLocalDate(launch.date)}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(launch.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Code */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px]">
                              {launch.code.replace(/-/g, '')}
                            </span>
                          </td>

                          {/* Product Name */}
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {launch.name}
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            +{launch.quantity.toFixed(2)}{' '}
                            <span className="text-[11px] font-normal text-slate-500">
                              {launch.type}
                            </span>
                          </td>

                          {/* Boxes & Tara */}
                          <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-600">
                            {launch.boxes && launch.boxes > 0 ? (
                              <span>
                                {launch.boxes} cx{' '}
                                <span className="text-slate-400">
                                  (-{(launch.boxes * 1.75).toFixed(2)}kg)
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            {launch.undone ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 font-sans">
                                Desfeito
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-sans">
                                Ativo
                              </span>
                            )}
                          </td>

                          {/* Undo Action */}
                          <td className="py-3 px-3 text-center print:hidden">
                            {!launch.undone && (
                              <button
                                onClick={() => setConfirmUndoModal({ isOpen: true, launch })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Desfazer este lançamento"
                              >
                                <Undo2 className="h-3 w-3" />
                                <span>Desfazer</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Undoing a Launch */}
      {confirmUndoModal.isOpen && confirmUndoModal.launch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Undo2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">
              Desfazer Lançamento?
            </h3>
            <p className="text-xs text-slate-600 mt-2 font-sans leading-relaxed">
              Deseja reverter o lançamento de{' '}
              <strong className="text-slate-900">
                {confirmUndoModal.launch.quantity.toFixed(2)}{' '}
                {confirmUndoModal.launch.type}
              </strong>{' '}
              do produto{' '}
              <strong className="text-slate-900">
                "{confirmUndoModal.launch.name}"
              </strong>
              ?
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-sans">
              Essa quantidade será subtraída da soma acumulada e, caso o item esteja na tabela ativa, será revertido imediatamente.
            </p>

            <div className="flex gap-2.5 mt-6">
              <button
                onClick={() => setConfirmUndoModal({ isOpen: false, launch: null })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmUndo(confirmUndoModal.launch!)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-600/20 transition cursor-pointer"
              >
                Sim, Desfazer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
