/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Trash2,
  FileDown,
  Search,
  Filter,
  Layers,
  Scale,
  PackageOpen,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Download,
  Printer,
  Check,
  AlertCircle,
  X,
  History,
  TrendingUp,
} from 'lucide-react';
import { LaunchRecord, RegisteredProduct } from '../types';
import Barcode from './Barcode';
import { jsPDF } from 'jspdf';

interface LaunchHistoryProps {
  launches: LaunchRecord[];
  products: RegisteredProduct[];
  selectedProductFilter?: string | null;
  onBackToTable: () => void;
  onBackToForm: () => void;
  onDeleteLaunch: (id: string) => void;
  onClearHistory: () => void;
}

export default function LaunchHistory({
  launches,
  products,
  selectedProductFilter: initialProductFilter,
  onBackToTable,
  onBackToForm,
  onDeleteLaunch,
  onClearHistory,
}: LaunchHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<string>(initialProductFilter || 'ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal confirmation
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: () => {},
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const showConfirm = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText: 'Cancelar',
      onConfirm: () => {
        onConfirm();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Distinct product list from launches for dropdown filter
  const distinctProductNames = useMemo(() => {
    const names = Array.from(new Set(launches.map(l => l.productName)));
    return names.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [launches]);

  // Filtered and sorted launches
  const filteredLaunches = useMemo(() => {
    let result = [...launches];

    // Filter by specific product
    if (productFilter !== 'ALL') {
      result = result.filter(l => l.productName === productFilter);
    }

    // Filter by search query (name or barcode)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qNoHyphen = q.replace(/-/g, '');
      result = result.filter(l => {
        const nameMatch = l.productName.toLowerCase().includes(q);
        const codeClean = (l.productCode || '').toLowerCase().replace(/-/g, '');
        const codeMatch = codeClean.includes(qNoHyphen) || (l.productCode || '').toLowerCase().includes(q);
        return nameMatch || codeMatch;
      });
    }

    // Sort by timestamp
    result.sort((a, b) => {
      return sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });

    return result;
  }, [launches, productFilter, searchQuery, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = filteredLaunches.length;
    const totalQty = filteredLaunches.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const totalBoxes = filteredLaunches.reduce((sum, l) => sum + (l.boxes || 0), 0);
    const uniqueProducts = new Set(filteredLaunches.map(l => l.productName)).size;
    return { totalCount, totalQty, totalBoxes, uniqueProducts };
  }, [filteredLaunches]);

  // Current selected product cumulative data
  const selectedProductCumulative = useMemo(() => {
    if (productFilter === 'ALL') return null;
    return products.find(p => p.name === productFilter) || null;
  }, [productFilter, products]);

  // Format date helper
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}:${seconds}`,
      full: `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`,
    };
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLaunches.length === 0) {
      showToast('Nenhum registro para exportar.');
      return;
    }

    const headers = ['Data', 'Horario', 'Codigo', 'Produto', 'Unidade', 'Qtd_Liquida', 'Qtd_Bruta', 'Caixas', 'Tara_KG'];
    const rows = filteredLaunches.map(l => {
      const dt = formatDate(l.timestamp);
      return [
        dt.date,
        dt.time,
        `"${l.productCode}"`,
        `"${l.productName}"`,
        l.type,
        l.quantity.toFixed(2),
        l.originalWeight ? l.originalWeight.toFixed(2) : '',
        l.boxes || '',
        l.tareWeight ? l.tareWeight.toFixed(2) : '',
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico_lancamentos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Extrato CSV baixado com sucesso!');
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (filteredLaunches.length === 0) {
      showToast('Nenhum registro para exportar.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let yPos = 18;

    // Header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, yPos, pageWidth - margin * 2, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('EXTRATO DE HISTÓRICO DE LANÇAMENTOS', margin + 6, yPos + 10.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    const dateStr = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, pageWidth - margin - 6, yPos + 10.5, { align: 'right' });

    yPos += 22;

    // Summary box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 14, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Lançamentos: ${stats.totalCount}`, margin + 6, yPos + 9);
    doc.text(`Produtos Distintos: ${stats.uniqueProducts}`, margin + 65, yPos + 9);
    doc.text(`Soma Líquida: ${stats.totalQty.toFixed(2)}`, margin + 125, yPos + 9);

    yPos += 20;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);

    doc.text('DATA/HORA', margin + 3, yPos + 5.5);
    doc.text('CÓDIGO', margin + 40, yPos + 5.5);
    doc.text('PRODUTO', margin + 65, yPos + 5.5);
    doc.text('UN', margin + 130, yPos + 5.5);
    doc.text('QTD LÍQUIDA', margin + 155, yPos + 5.5, { align: 'right' });
    doc.text('OBS / TARA', margin + 180, yPos + 5.5, { align: 'right' });

    yPos += 9;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    filteredLaunches.forEach((l, idx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 18;
        // Repeat mini header
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('DATA/HORA', margin + 3, yPos + 5.5);
        doc.text('CÓDIGO', margin + 40, yPos + 5.5);
        doc.text('PRODUTO', margin + 65, yPos + 5.5);
        doc.text('UN', margin + 130, yPos + 5.5);
        doc.text('QTD LÍQUIDA', margin + 155, yPos + 5.5, { align: 'right' });
        doc.text('OBS / TARA', margin + 180, yPos + 5.5, { align: 'right' });
        yPos += 9;
        doc.setFont('helvetica', 'normal');
      }

      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 3.5, pageWidth - margin * 2, 7.5, 'F');
      }

      const dt = formatDate(l.timestamp);
      doc.setTextColor(51, 65, 85);
      doc.text(`${dt.date} ${dt.time}`, margin + 3, yPos + 2);
      doc.text(l.productCode, margin + 40, yPos + 2);

      const truncatedName = l.productName.length > 32 ? l.productName.substring(0, 31) + '…' : l.productName;
      doc.text(truncatedName, margin + 65, yPos + 2);
      doc.text(l.type, margin + 130, yPos + 2);

      doc.setFont('helvetica', 'bold');
      doc.text(l.quantity.toFixed(2), margin + 155, yPos + 2, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      const obs = l.boxes ? `${l.boxes} cx (-${(l.boxes * 1.75).toFixed(2)}kg)` : '-';
      doc.text(obs, margin + 180, yPos + 2, { align: 'right' });

      yPos += 7.5;
    });

    doc.save(`extrato_lancamentos_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('Extrato PDF gerado com sucesso!');
  };

  const handleDeleteItem = (id: string, name: string, qty: number) => {
    showConfirm(
      'Excluir Lançamento Individual',
      `Deseja realmente excluir o lançamento de ${qty.toFixed(2)} de "${name}"? A quantidade total deste produto na tabela cumulativa será automaticamente recalculada.`,
      'Excluir Lançamento',
      () => {
        onDeleteLaunch(id);
        showToast('Lançamento removido e total recalculado!');
      }
    );
  };

  const handleClearAllHistory = () => {
    showConfirm(
      'Limpar Todo o Histórico',
      'Atenção: Isso apagará o histórico de todos os lançamentos individuais gravados. (A tabela cumulativa atual será mantida). Deseja continuar?',
      'Limpar Histórico',
      () => {
        onClearHistory();
        showToast('Histórico de lançamentos limpo!');
      }
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{modalConfig.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Operação de auditoria e recálculo</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{modalConfig.message}</p>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              >
                {modalConfig.cancelText}
              </button>
              <button
                onClick={modalConfig.onConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer transition-colors shadow-sm shadow-red-600/20"
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToTable}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              title="Voltar para a Tabela Cumulativa"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-1">
                <History className="h-3 w-3 text-slate-600" />
                Histórico & Auditoria
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Histórico de Lançamentos Individuais
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualize cada pesagem separadamente, mesmo que a tabela principal acumule os totais.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onBackToForm}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-all shadow-xs"
            >
              Novo Lançamento
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              title="Exportar para planilha Excel / CSV"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Gerar Extrato em PDF"
            >
              <Printer className="h-4 w-4 text-slate-300" />
              <span>Extrato PDF</span>
            </button>
            {launches.length > 0 && (
              <button
                onClick={handleClearAllHistory}
                className="p-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer transition-colors"
                title="Limpar todo o histórico de lançamentos"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Lançamentos Feitos
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {stats.totalCount}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              pesagens registradas
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Produtos Distintos
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {stats.uniqueProducts}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              itens movimentados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Soma Quantidade Líquida
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {stats.totalQty.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              total de peso/unidades
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Caixas Descontadas
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {stats.totalBoxes}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              -{(stats.totalBoxes * 1.75).toFixed(2)} kg de tara
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome do produto ou código de barras..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Product selector dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
            Filtrar Produto:
          </label>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 cursor-pointer max-w-[240px] truncate"
          >
            <option value="ALL">Todos os Produtos ({distinctProductNames.length})</option>
            {distinctProductNames.map(name => {
              const count = launches.filter(l => l.productName === name).length;
              return (
                <option key={name} value={name}>
                  {name} ({count}x)
                </option>
              );
            })}
          </select>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            title={sortOrder === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
          >
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">
              {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
            </span>
            {sortOrder === 'desc' ? (
              <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Product Highlight Card (if filtered by a single product) */}
      {selectedProductCumulative && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-[11px] font-medium tracking-wide">
              <span>Extrato Específico do Item</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {selectedProductCumulative.name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span>Unidade: <strong className="text-white font-mono">{selectedProductCumulative.type}</strong></span>
              <span>•</span>
              <span>Lançamentos Registrados: <strong className="text-white font-mono">{filteredLaunches.length} vezes</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-xs border border-white/10">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">
                Total Acumulado na Tabela
              </span>
              <span className="text-3xl font-extrabold font-mono text-emerald-400">
                {selectedProductCumulative.quantity.toFixed(2)}
              </span>
              <span className="text-xs text-slate-300 font-mono ml-1.5">
                {selectedProductCumulative.type}
              </span>
            </div>

            <button
              onClick={() => setProductFilter('ALL')}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors text-xs font-semibold"
              title="Limpar filtro e ver todos os produtos"
            >
              Ver Todos
            </button>
          </div>
        </div>
      )}

      {/* Main Launches Timeline / Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        {filteredLaunches.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center p-4 bg-slate-100 text-slate-400 rounded-3xl mb-3">
              <History className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Nenhum lançamento encontrado
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {launches.length === 0
                ? 'Nenhum lançamento foi registrado ainda. Assim que você lançar produtos no formulário, cada pesagem aparecerá detalhada nesta lista.'
                : 'Nenhum lançamento corresponde ao filtro ou busca selecionada.'}
            </p>
            {productFilter !== 'ALL' && (
              <button
                onClick={() => setProductFilter('ALL')}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-16 text-center">
                      #
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-44">
                      Data & Hora
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Produto / Código de Barras
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center w-20">
                      Un
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right w-44">
                      Qtd Lançada (Líquida)
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left w-52">
                      Pesagem & Tara
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center w-20">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLaunches.map((launch, index) => {
                    const dt = formatDate(launch.timestamp);
                    const itemNumber = sortOrder === 'desc' 
                      ? filteredLaunches.length - index 
                      : index + 1;

                    return (
                      <tr
                        key={launch.id}
                        className="hover:bg-slate-50/60 transition-colors group"
                      >
                        {/* Index */}
                        <td className="px-5 py-4 text-center">
                          <span className="text-xs font-mono font-semibold text-slate-400">
                            {itemNumber}º
                          </span>
                        </td>

                        {/* Date and time */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {dt.date}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {dt.time}
                            </span>
                          </div>
                        </td>

                        {/* Product and Barcode */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {launch.productName}
                              </span>
                              {productFilter === 'ALL' && (
                                <button
                                  onClick={() => setProductFilter(launch.productName)}
                                  className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
                                  title={`Ver apenas lançamentos de ${launch.productName}`}
                                >
                                  (Filtrar)
                                </button>
                              )}
                            </div>
                            <Barcode value={launch.productCode} />
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="px-5 py-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                            {launch.type}
                          </span>
                        </td>

                        {/* Liquid Quantity */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-base font-extrabold font-mono text-emerald-600">
                              +{launch.quantity.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              líquido registrado
                            </span>
                          </div>
                        </td>

                        {/* Tare and Gross info */}
                        <td className="px-5 py-4">
                          {launch.boxes && launch.boxes > 0 ? (
                            <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <PackageOpen className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-semibold">{launch.boxes} caixas</span>
                                <span className="text-slate-400">(-{(launch.boxes * 1.75).toFixed(2)}kg)</span>
                              </div>
                              {launch.originalWeight && (
                                <span className="text-[11px] text-slate-500">
                                  Peso bruto balança: <strong>{launch.originalWeight.toFixed(2)} kg</strong>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Sem caixas (direto)</span>
                          )}
                        </td>

                        {/* Delete single launch action */}
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => handleDeleteItem(launch.id, launch.productName, launch.quantity)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                            title="Excluir este lançamento específico (recalcula a tabela)"
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

            {/* Mobile Cards View */}
            <div className="block md:hidden p-4 space-y-3">
              {filteredLaunches.map((launch, index) => {
                const dt = formatDate(launch.timestamp);
                const itemNumber = sortOrder === 'desc' 
                  ? filteredLaunches.length - index 
                  : index + 1;

                return (
                  <div
                    key={launch.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                          #{itemNumber}º Lançamento
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          {launch.productName}
                        </h4>
                      </div>
                      <span className="text-base font-extrabold font-mono text-emerald-600">
                        +{launch.quantity.toFixed(2)} {launch.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {dt.date} às {dt.time}
                      </span>
                      {launch.boxes && launch.boxes > 0 && (
                        <span>{launch.boxes} caixas (tara: -{(launch.boxes * 1.75).toFixed(2)}kg)</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Barcode value={launch.productCode} />
                      <button
                        onClick={() => handleDeleteItem(launch.id, launch.productName, launch.quantity)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
