/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useId, useMemo } from 'react';
import {
  ArrowLeft,
  Trash2,
  FileDown,
  CheckSquare,
  Square,
  Calendar,
  Tag,
  AlertCircle,
  X,
  Check,
  Info,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Search,
  SlidersHorizontal,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp10,
  Filter,
  CalendarDays,
  Scale,
  Split,
  Percent,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { RegisteredProduct } from '../types';
import { PRODUCTS_DATABASE } from '../productsData';
import Barcode from './Barcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

interface ProductTableProps {
  products: RegisteredProduct[];
  onBack: () => void;
  onViewPeriodsHistory?: () => void;
  tableCreatedAt?: number | null;
  onDeleteProducts: (names: string[]) => void;
  onClearAll: () => void;
  onToggleClassification: (name: string, classification: 'NT' | 'QB') => void;
  onUpdateClassificationSplit?: (name: string, quantityNT: number, quantityQB: number) => void;
}

export default function ProductTable({
  products,
  onBack,
  onViewPeriodsHistory,
  tableCreatedAt,
  onDeleteProducts,
  onClearAll,
  onToggleClassification,
  onUpdateClassificationSplit,
}: ProductTableProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const selectAllId = useId();

  // Custom beautiful confirm modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: 'danger' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'info',
    onConfirm: () => {},
  });

  // Custom toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showConfirm = (
    title: string,
    message: string,
    confirmText: string,
    type: 'danger' | 'info',
    onConfirm: () => void
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText: 'Cancelar',
      type,
      onConfirm: () => {
        onConfirm();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Get barcode code for a product
  const getProductCode = (name: string): string => {
    const cleanName = name.trim().toUpperCase();
    const match = PRODUCTS_DATABASE.find(
      p => p.name.toUpperCase() === cleanName
    );
    if (match) return match.code.replace(/-/g, '');

    // Fallback: match without measure suffix (e.g. "TOMATE LONGA VIDA" or "MACA GALA")
    const cleanNoSuffix = cleanName.replace(/\s+(KG|UN|BJ|CX|PT|SC|DZ|GF|PO)$/, '');
    const matchWithoutSuffix = PRODUCTS_DATABASE.find(p => {
      const pClean = p.name.toUpperCase().replace(/\s+(KG|UN|BJ|CX|PT|SC|DZ|GF|PO)$/, '');
      return pClean === cleanNoSuffix;
    });
    if (matchWithoutSuffix) return matchWithoutSuffix.code.replace(/-/g, '');

    // Special hortifruti aliases (all with the check digit included, no hyphen)
    if (cleanName === 'MACA GALA' || cleanName === 'MACA GALA KG') return '0001915';
    if (cleanName === 'TOMATE LONGA VIDA' || cleanName === 'TOMATE LONGA VIDA KG') return '0064248';
    if (cleanName === 'TOMATE CAQUI' || cleanName === 'TOMATE CAQUI KG') return '0270625';
    if (cleanName === 'BATATA ASTERIX' || cleanName === 'BATATA ASTERIX KG') return '0079143';
    if (cleanName === 'BATATA BAROA' || cleanName === 'BATATA BAROA KG') return '3806838';
    if (cleanName === 'CASTANHA CAJU' || cleanName === 'CASTANHA CAJU KG') return '0269957';
    if (cleanName === 'MEXERICA MURCOTE' || cleanName === 'MEXERICA MURCOTE KG') return '0056106';
    if (cleanName === 'TAIOBA' || cleanName === 'TAIOBA L.ARAUJO UN') return '1318975';
    if (cleanName === 'ALFACE' || cleanName === 'ALFACE L.ARAUJO UN') return '1318715';

    return '0000000';
  };

  const [sortBy, setSortBy] = useState<'quantity' | 'name'>('quantity');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | 'NT' | 'QB' | 'SPLIT'>('ALL');

  // Helper to extract NT / QB breakdown for a given product
  const getProductClassificationInfo = (p: RegisteredProduct) => {
    let nt = 0;
    let qb = 0;
    if (p.quantityNT !== undefined || p.quantityQB !== undefined) {
      nt = p.quantityNT || 0;
      qb = p.quantityQB || 0;
    } else if (p.classification === 'NT') {
      nt = p.quantity;
      qb = 0;
    } else if (p.classification === 'QB') {
      qb = p.quantity;
      nt = 0;
    }
    const isSplit = nt > 0 && qb > 0;
    const isAllNT = nt > 0 && qb === 0;
    const isAllQB = qb > 0 && nt === 0;
    const isUnclassified = nt === 0 && qb === 0;
    const pctNT = p.quantity > 0 ? Math.min(100, Math.max(0, (nt / p.quantity) * 100)) : 0;
    const pctQB = p.quantity > 0 ? Math.min(100, Math.max(0, (qb / p.quantity) * 100)) : 0;
    return { nt, qb, isSplit, isAllNT, isAllQB, isUnclassified, pctNT, pctQB };
  };

  // Split Modal State
  const [splitModal, setSplitModal] = useState<{
    isOpen: boolean;
    product: RegisteredProduct | null;
    quantityNT: number;
    quantityQB: number;
    ntInput: string;
    qbInput: string;
  }>({
    isOpen: false,
    product: null,
    quantityNT: 0,
    quantityQB: 0,
    ntInput: '0.00',
    qbInput: '0.00',
  });

  const openSplitModal = (product: RegisteredProduct) => {
    const info = getProductClassificationInfo(product);
    let initNT = info.nt;
    let initQB = info.qb;
    if (info.isUnclassified) {
      initNT = product.quantity;
      initQB = 0;
    }

    setSplitModal({
      isOpen: true,
      product,
      quantityNT: initNT,
      quantityQB: initQB,
      ntInput: initNT.toFixed(2),
      qbInput: initQB.toFixed(2),
    });
  };

  const closeSplitModal = () => {
    setSplitModal(prev => ({ ...prev, isOpen: false, product: null }));
  };

  const handleSplitModalNTChange = (val: string) => {
    const formatted = val.replace(',', '.');
    if (formatted === '' || /^\d+(\.\d{0,2})?$/.test(formatted) || /^\.\d{0,2}$/.test(formatted)) {
      const numNT = parseFloat(formatted) || 0;
      const total = splitModal.product?.quantity || 0;
      const calculatedQB = Math.max(0, Number((total - numNT).toFixed(2)));
      setSplitModal(prev => ({
        ...prev,
        ntInput: formatted,
        qbInput: calculatedQB.toFixed(2),
        quantityNT: numNT,
        quantityQB: calculatedQB,
      }));
    }
  };

  const handleSplitModalQBChange = (val: string) => {
    const formatted = val.replace(',', '.');
    if (formatted === '' || /^\d+(\.\d{0,2})?$/.test(formatted) || /^\.\d{0,2}$/.test(formatted)) {
      const numQB = parseFloat(formatted) || 0;
      const total = splitModal.product?.quantity || 0;
      const calculatedNT = Math.max(0, Number((total - numQB).toFixed(2)));
      setSplitModal(prev => ({
        ...prev,
        qbInput: formatted,
        ntInput: calculatedNT.toFixed(2),
        quantityQB: numQB,
        quantityNT: calculatedNT,
      }));
    }
  };

  const handleSplitPreset = (percentNT: number) => {
    if (!splitModal.product) return;
    const total = splitModal.product.quantity;
    if (percentNT === 0) {
      setSplitModal(prev => ({
        ...prev,
        quantityNT: 0,
        quantityQB: total,
        ntInput: '0.00',
        qbInput: total.toFixed(2),
      }));
    } else if (percentNT === 100) {
      setSplitModal(prev => ({
        ...prev,
        quantityNT: total,
        quantityQB: 0,
        ntInput: total.toFixed(2),
        qbInput: '0.00',
      }));
    } else {
      const calculatedNT = Number(((total * percentNT) / 100).toFixed(2));
      const calculatedQB = Number(Math.max(0, total - calculatedNT).toFixed(2));
      setSplitModal(prev => ({
        ...prev,
        quantityNT: calculatedNT,
        quantityQB: calculatedQB,
        ntInput: calculatedNT.toFixed(2),
        qbInput: calculatedQB.toFixed(2),
      }));
    }
  };

  const handleSaveSplit = () => {
    if (!splitModal.product) return;
    const numNT = parseFloat(splitModal.ntInput) || 0;
    const numQB = parseFloat(splitModal.qbInput) || 0;

    if (onUpdateClassificationSplit) {
      onUpdateClassificationSplit(splitModal.product.name, numNT, numQB);
    }
    showToast(`Divisão salva: ${numNT.toFixed(2)} NT e ${numQB.toFixed(2)} QB para ${splitModal.product.name}`);
    closeSplitModal();
  };

  // Summary metrics for NT, QB, and totals across all products
  const tableStats = useMemo(() => {
    let totalKg = 0;
    let totalUn = 0;
    let totalNTKg = 0;
    let totalNTUn = 0;
    let totalQBKg = 0;
    let totalQBUn = 0;
    let totalUnclassifiedKg = 0;
    let totalUnclassifiedUn = 0;
    let countNT = 0;
    let countQB = 0;
    let countSplit = 0;

    products.forEach((p) => {
      const { nt, qb, isSplit } = getProductClassificationInfo(p);
      const unclass = Math.max(0, Number((p.quantity - (nt + qb)).toFixed(2)));

      if (nt > 0) countNT++;
      if (qb > 0) countQB++;
      if (isSplit) countSplit++;

      if (p.type === 'KG') {
        totalKg += p.quantity;
        totalNTKg += nt;
        totalQBKg += qb;
        totalUnclassifiedKg += unclass;
      } else {
        totalUn += p.quantity;
        totalNTUn += nt;
        totalQBUn += qb;
        totalUnclassifiedUn += unclass;
      }
    });

    const totalWeight = totalKg;
    const pctNT = totalWeight > 0 ? (totalNTKg / totalWeight) * 100 : 0;
    const pctQB = totalWeight > 0 ? (totalQBKg / totalWeight) * 100 : 0;

    return {
      totalKg,
      totalUn,
      totalNTKg,
      totalNTUn,
      totalQBKg,
      totalQBUn,
      totalUnclassifiedKg,
      totalUnclassifiedUn,
      countNT,
      countQB,
      countSplit,
      pctNT,
      pctQB,
    };
  }, [products]);

  // Filter and sort products according to user preference (alphabetical or weight quantity)
  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter((p) => {
      // Search query filter (matches name or barcode code)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const queryNoHyphen = query.replace(/-/g, '');
        const code = getProductCode(p.name).toLowerCase();
        const codeNoHyphen = code.replace(/-/g, '');
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesCode = code.includes(query) || (queryNoHyphen.length >= 2 && codeNoHyphen.includes(queryNoHyphen));
        if (!matchesName && !matchesCode) return false;
      }

      // Classification filter
      if (classificationFilter !== 'ALL') {
        const info = getProductClassificationInfo(p);
        if (classificationFilter === 'NT' && info.nt <= 0) return false;
        if (classificationFilter === 'QB' && info.qb <= 0) return false;
        if (classificationFilter === 'SPLIT' && !info.isSplit) return false;
      }

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === 'quantity') {
        const diff = sortOrder === 'desc' ? b.quantity - a.quantity : a.quantity - b.quantity;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      } else {
        const diff = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        return sortOrder === 'asc' ? diff : -diff;
      }
    });
  }, [products, sortBy, sortOrder, searchQuery, classificationFilter]);

  const handleToggleSort = (field: 'quantity' | 'name') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'quantity' ? 'desc' : 'asc');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setClassificationFilter('ALL');
  };

  // Select all or deselect all (applies to visible/filtered list)
  const handleSelectAll = () => {
    if (selectedProducts.length === filteredAndSortedProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredAndSortedProducts.map(p => p.name));
    }
  };

  // Toggle selection for a single product
  const handleToggleSelect = (name: string) => {
    setSelectedProducts(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  // Delete checked products with beautiful confirm modal
  const handleDeleteSelected = () => {
    if (selectedProducts.length === 0) {
      showToast('Selecione pelo menos um produto para excluir!');
      return;
    }

    showConfirm(
      'Excluir Selecionados',
      `Deseja realmente excluir os ${selectedProducts.length} produto(s) selecionado(s)? Esta ação não pode ser desfeita.`,
      'Excluir',
      'danger',
      () => {
        onDeleteProducts(selectedProducts);
        setSelectedProducts([]);
        showToast('Produtos selecionados excluídos com sucesso!');
      }
    );
  };

  // Delete all products with beautiful confirm modal
  const handleClearAllClick = () => {
    if (products.length === 0) return;
    showConfirm(
      'Limpar Toda a Tabela',
      'Aviso: Isso irá excluir TODOS os produtos registrados! Tem certeza que deseja continuar?',
      'Limpar Tudo',
      'danger',
      () => {
        onClearAll();
        setSelectedProducts([]);
        showToast('Todos os produtos foram excluídos!');
      }
    );
  };

  // Only export selected products if there are any, otherwise export filtered and sorted products
  const productsToExport = useMemo(() => {
    return selectedProducts.length > 0
      ? filteredAndSortedProducts.filter(p => selectedProducts.includes(p.name))
      : filteredAndSortedProducts;
  }, [selectedProducts, filteredAndSortedProducts]);

  // Split products into pages dynamically to avoid overflow and respect maximum 8 items per page
  const productPages = useMemo(() => {
    const pages: RegisteredProduct[][] = [];
    let currentPage: RegisteredProduct[] = [];
    let currentHeight = 0;
    const maxHeight = 680; // Available vertical height in pixels for product rows on a page
    const maxItems = 8;

    for (const product of productsToExport) {
      // Estimate height of this product row:
      // Base padding + name + compact barcode is around 70px.
      let estimatedRowHeight = 70;
      
      // If the product name is long (e.g., > 28 chars), it wraps to multiple lines
      if (product.name.length > 28) {
        estimatedRowHeight += Math.ceil((product.name.length - 28) / 25) * 16;
      }

      // If there are boxes, add some space for the extra line below the weight
      if (product.boxes && product.boxes > 0) {
        estimatedRowHeight += 14;
      }

      // If the current item would cause either of the limits to be exceeded, start a new page
      if (currentPage.length >= maxItems || (currentPage.length > 0 && currentHeight + estimatedRowHeight > maxHeight)) {
        pages.push(currentPage);
        currentPage = [product];
        currentHeight = estimatedRowHeight;
      } else {
        currentPage.push(product);
        currentHeight += estimatedRowHeight;
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [productsToExport]);

  // Optimized lightweight React-DOM-based PDF generator
  const handleExportPDF = async () => {
    if (productsToExport.length === 0) {
      showToast('Não há produtos para exportar!');
      return;
    }

    try {
      setIsExporting(true);

      // Wait for React to render the high-fidelity preview sheet modal and paint all Barcode SVGs
      await new Promise(resolve => setTimeout(resolve, 1000));

      const totalPages = productPages.length;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const pageElement = document.getElementById(`real-pdf-preview-sheet-page-${pageIdx}`);
        if (!pageElement) {
          throw new Error(`Elemento da página ${pageIdx + 1} não foi encontrado.`);
        }

        // Capture page using html2canvas
        const canvas = await html2canvas(pageElement, {
          scale: 2.0, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            // Remove external stylesheet link tags to avoid slow fetches or errors
            const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
            links.forEach(el => el.parentNode?.removeChild(el));

            // Replace unsupported oklch() colors inside <style> tags with safe fallback colors
            const styles = clonedDoc.querySelectorAll('style');
            styles.forEach(el => {
              if (el.textContent) {
                el.textContent = el.textContent.replace(/oklch\([^)]+\)/g, 'rgb(100, 116, 139)');
              }
            });
          }
        });

        // Determine optimal compression/quality to meet the "maximum 300kb per page" constraint.
        // Let's start with a high quality (0.95) for ultra-sharp rendering.
        // 300kb = 307200 bytes. Base64 length = 307200 * 4/3 = 409600.
        let quality = 0.95;
        let jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Loop to reduce quality if it exceeds ~300kb (approx 400,000 chars in base64 format)
        while (jpegDataUrl.length > 400000 && quality > 0.3) {
          quality -= 0.05;
          jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const imgWidth = 210; // A4 dimension in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (pageIdx > 0) {
          pdf.addPage();
        }

        // Add image to PDF document
        pdf.addImage(jpegDataUrl, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }

      // Generate localized date-time filename
      const now = new Date();
      const dayStr = String(now.getDate()).padStart(2, '0');
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const hourStr = String(now.getHours()).padStart(2, '0');
      const minStr = String(now.getMinutes()).padStart(2, '0');
      const filename = `recebimento_${dayStr}-${monthStr}_${hourStr}h${minStr}.pdf`;

      // Trigger automatic direct browser download
      pdf.save(filename);
      setIsExporting(false);
      showToast('PDF exportado com sucesso!');
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('Houve um erro ao gerar o PDF. Por favor, tente novamente!');
      setIsExporting(false);
    }
  };

  // Fixed date from session creation: if table is not deleted, the date is preserved!
  const targetDate = tableCreatedAt && products.length > 0 ? new Date(tableCreatedAt) : new Date();

  const formattedDate = targetDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Pages are dynamically calculated to prevent page overflows and handle clean breaks

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-5 md:p-8">
      {/* Header and Back navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onBack}
              className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Voltar para o Registro
            </button>
            {onViewPeriodsHistory && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  onClick={onViewPeriodsHistory}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                  Ver Histórico por Período
                </button>
              </>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Produtos Registrados
          </h2>
        </div>

        {/* Date visual pill (locked to session creation date) */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-xl text-slate-700 text-xs font-medium max-w-fit">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span className="capitalize font-sans">{formattedDate}</span>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nenhum produto registrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Utilize o formulário de registro para cadastrar mercadorias e controlar os pesos das caixas.
          </p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Registrar Agora
          </button>
        </div>
      ) : (
        <>
          {/* KPI Metrics Summary Bar for NT and QB */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {/* Total General */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Volume Total</span>
                <Scale className="h-4 w-4 text-slate-400" />
              </div>
              <div>
                <span className="text-xl font-black font-mono text-slate-900 tracking-tight">
                  {tableStats.totalKg.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-500 ml-1 font-mono">KG</span>
                {tableStats.totalUn > 0 && (
                  <span className="text-xs font-semibold text-slate-600 block mt-0.5">
                    + {tableStats.totalUn.toFixed(2)} UN
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {products.length} {products.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
              </span>
            </div>

            {/* Total NT (Nota) */}
            <div className="bg-green-50/50 border border-green-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-green-700 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                  Total Nota (NT)
                </span>
                <span className="text-[10px] font-black bg-green-200/60 text-green-800 px-1.5 py-0.5 rounded">
                  {tableStats.pctNT.toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-xl font-black font-mono text-green-950 tracking-tight">
                  {tableStats.totalNTKg.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-green-800 ml-1 font-mono">KG</span>
                {tableStats.totalNTUn > 0 && (
                  <span className="text-xs font-semibold text-green-700 block mt-0.5">
                    + {tableStats.totalNTUn.toFixed(2)} UN
                  </span>
                )}
              </div>
              <span className="text-[10px] text-green-700/80 mt-1 font-medium">
                {tableStats.countNT} {tableStats.countNT === 1 ? 'item com NT' : 'itens com NT'}
              </span>
            </div>

            {/* Total QB (Quebra) */}
            <div className="bg-red-50/50 border border-red-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-red-700 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  Total Quebra (QB)
                </span>
                <span className="text-[10px] font-black bg-red-200/60 text-red-800 px-1.5 py-0.5 rounded">
                  {tableStats.pctQB.toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-xl font-black font-mono text-red-950 tracking-tight">
                  {tableStats.totalQBKg.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-red-800 ml-1 font-mono">KG</span>
                {tableStats.totalQBUn > 0 && (
                  <span className="text-xs font-semibold text-red-700 block mt-0.5">
                    + {tableStats.totalQBUn.toFixed(2)} UN
                  </span>
                )}
              </div>
              <span className="text-[10px] text-red-700/80 mt-1 font-medium">
                {tableStats.countQB} {tableStats.countQB === 1 ? 'item com QB' : 'itens com QB'}
              </span>
            </div>

            {/* Split Items / Distribution */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Split className="h-3.5 w-3.5 text-slate-500" />
                  Divisões Ativas
                </span>
                <span className="text-[10px] font-bold bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded">
                  {tableStats.countSplit}
                </span>
              </div>
              <div className="space-y-1.5 my-auto">
                <div className="w-full bg-slate-200 rounded-full h-2 flex overflow-hidden">
                  <div style={{ width: `${tableStats.pctNT}%` }} className="bg-green-500 h-full" title={`NT: ${tableStats.pctNT.toFixed(1)}%`} />
                  <div style={{ width: `${tableStats.pctQB}%` }} className="bg-red-500 h-full" title={`QB: ${tableStats.pctQB.toFixed(1)}%`} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span className="text-green-700 font-bold">NT: {tableStats.pctNT.toFixed(0)}%</span>
                  <span className="text-red-700 font-bold">QB: {tableStats.pctQB.toFixed(0)}%</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {tableStats.totalUnclassifiedKg > 0.01 ? (
                  <span className="text-amber-600 font-semibold">{tableStats.totalUnclassifiedKg.toFixed(2)} KG s/ classificar</span>
                ) : (
                  <span className="text-green-600 font-semibold">100% classificado</span>
                )}
              </span>
            </div>
          </div>

          {/* Enhanced Filter and Sort Toolbar */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 mb-6 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
              
              {/* Search Bar Input */}
              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por nome do produto ou código..."
                  className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sort Order Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
                  Ordenar:
                </span>

                {/* Alphabetical Sort Button */}
                <button
                  onClick={() => handleToggleSort('name')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs ${
                    sortBy === 'name'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                  title="Ordenar em ordem alfabética"
                >
                  {sortBy === 'name' && sortOrder === 'desc' ? (
                    <ArrowUpAZ className="h-4 w-4 shrink-0 text-slate-200" />
                  ) : (
                    <ArrowDownAZ className="h-4 w-4 shrink-0" />
                  )}
                  <span>Ordem Alfabética</span>
                  {sortBy === 'name' && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded">
                      {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
                    </span>
                  )}
                </button>

                {/* Quantity / Weight Sort Button */}
                <button
                  onClick={() => handleToggleSort('quantity')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs ${
                    sortBy === 'quantity'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                  title="Ordenar por quantidade / peso dos produtos"
                >
                  {sortBy === 'quantity' && sortOrder === 'asc' ? (
                    <ArrowUp10 className="h-4 w-4 shrink-0 text-slate-200" />
                  ) : (
                    <ArrowDown01 className="h-4 w-4 shrink-0" />
                  )}
                  <span>Quantidade / Peso</span>
                  {sortBy === 'quantity' && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded">
                      {sortOrder === 'desc' ? 'Maior' : 'Menor'}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Classification Status Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                  Classificação:
                </span>
                <button
                  onClick={() => setClassificationFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    classificationFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Todos ({products.length})
                </button>
                <button
                  onClick={() => setClassificationFilter('NT')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    classificationFilter === 'NT'
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'
                  }`}
                >
                  Nota (NT) ({tableStats.countNT})
                </button>
                <button
                  onClick={() => setClassificationFilter('QB')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    classificationFilter === 'QB'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                  }`}
                >
                  Quebra (QB) ({tableStats.countQB})
                </button>
                {tableStats.countSplit > 0 && (
                  <button
                    onClick={() => setClassificationFilter('SPLIT')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      classificationFilter === 'SPLIT'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    <Split className="h-3 w-3" />
                    <span>Divididos ({tableStats.countSplit})</span>
                  </button>
                )}
              </div>

              {/* Status info & Reset filters */}
              <div className="flex items-center gap-3 text-slate-500 text-xs">
                <span>
                  Exibindo <strong>{filteredAndSortedProducts.length}</strong> de {products.length} {products.length === 1 ? 'produto' : 'produtos'}
                </span>
                {(searchQuery || classificationFilter !== 'ALL') && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-slate-700 underline font-semibold hover:text-slate-900 cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Filter className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Nenhum produto corresponde aos filtros</h4>
              <p className="text-xs text-slate-500 mt-1">
                Tente ajustar a busca ou limpar os filtros de classificação.
              </p>
              <button
                onClick={resetFilters}
                className="mt-3 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <>
              {/* Dual layout view: Table for Desktops/Tablets, Cards for Mobile */}
              
              {/* Desktop Table view (hidden on small screens, shown from md up) */}
              <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-sm">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <th className="px-4 py-3.5 w-12 text-center">
                        <button
                          onClick={handleSelectAll}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                          title="Selecionar Todos"
                        >
                          {selectedProducts.length === filteredAndSortedProducts.length && filteredAndSortedProducts.length > 0 ? (
                            <CheckSquare className="h-4 w-4 text-slate-800" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                        <button
                          onClick={() => handleToggleSort('name')}
                          className="flex items-center gap-1.5 hover:text-slate-800 focus:outline-none cursor-pointer group"
                          title="Clique para ordenar por ordem alfabética"
                        >
                          <span>Produto / Código de Barras</span>
                          {sortBy === 'name' ? (
                            sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-slate-800 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 text-slate-800 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center font-sans w-24">
                        Unidade
                      </th>
                      <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right font-sans w-40">
                        <button
                          onClick={() => handleToggleSort('quantity')}
                          className="ml-auto flex items-center justify-end gap-1.5 hover:text-slate-800 focus:outline-none cursor-pointer group"
                          title="Clique para ordenar por quantidade de peso"
                        >
                          <span>Quantidade Líquida</span>
                          {sortBy === 'quantity' ? (
                            sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-slate-800 shrink-0" /> : <ArrowUp className="h-3.5 w-3.5 text-slate-800 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center font-sans w-40">
                        Classificação (NT / QB)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedProducts.map((product) => {
                      const isChecked = selectedProducts.includes(product.name);
                      return (
                        <tr
                          key={product.name}
                          className={`group hover:bg-slate-50/50 transition-colors ${
                            isChecked ? 'bg-slate-50/30' : ''
                          }`}
                        >
                          {/* Checkbox column */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => handleToggleSelect(product.name)}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-slate-800" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>

                          {/* Name & Generated Barcode column */}
                          <td className="px-4 py-4 min-w-[220px]">
                            <div className="flex flex-col gap-2">
                              <span className="font-semibold text-slate-800 text-sm font-sans tracking-tight">
                                {product.name}
                              </span>
                              <Barcode value={getProductCode(product.name)} />
                            </div>
                          </td>

                          {/* Measure unit badge */}
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold font-mono bg-slate-100 text-slate-700 rounded-md">
                              {product.type}
                            </span>
                          </td>

                          {/* Registered quantity with dynamic boxes tooltips */}
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-slate-950 font-mono text-sm">
                                {product.quantity.toFixed(2)}
                              </span>
                              {product.boxes && product.boxes > 0 && (
                                <span className="text-[10px] text-slate-500 font-sans mt-0.5">
                                  {product.boxes} caixas (Tara: -{(product.boxes * 1.75).toFixed(2)}kg)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Interactive classification buttons with NT/QB split */}
                          <td className="px-4 py-4 text-center">
                            {(() => {
                              const info = getProductClassificationInfo(product);

                              if (info.isSplit) {
                                return (
                                  <div className="flex flex-col items-center gap-1.5 min-w-[190px] mx-auto">
                                    <div className="flex items-center gap-1.5 w-full justify-center">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-green-50 text-green-700 border border-green-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        NT: {info.nt.toFixed(2)}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-red-50 text-red-700 border border-red-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                        QB: {info.qb.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="w-full max-w-[160px] bg-slate-100 rounded-full h-1.5 flex overflow-hidden border border-slate-200/50">
                                      <div style={{ width: `${info.pctNT}%` }} className="bg-green-500 h-full" title={`NT: ${info.pctNT.toFixed(1)}%`} />
                                      <div style={{ width: `${info.pctQB}%` }} className="bg-red-500 h-full" title={`QB: ${info.pctQB.toFixed(1)}%`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => openSplitModal(product)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/80 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                        title="Alterar quanto é QB e quanto é NT"
                                      >
                                        <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                                        <span>Ajustar Divisão</span>
                                      </button>
                                      <button
                                        onClick={() => onToggleClassification(product.name, 'NT')}
                                        className="text-[10px] text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Remover classificação"
                                      >
                                        Limpar
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              if (info.isAllNT) {
                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => onToggleClassification(product.name, 'NT')}
                                      className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-green-500 text-white border-green-600 shadow-sm shadow-green-500/20 cursor-pointer"
                                      title="100% Nota (Clique para desmarcar)"
                                    >
                                      NT ({info.nt.toFixed(2)})
                                    </button>
                                    <button
                                      onClick={() => onToggleClassification(product.name, 'QB')}
                                      className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                      title="Mudar para 100% Quebra"
                                    >
                                      QB
                                    </button>
                                    <button
                                      onClick={() => openSplitModal(product)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
                                      title="Dividir quantidade entre QB e NT"
                                    >
                                      <Split className="h-3.5 w-3.5 text-slate-500" />
                                      <span>Dividir</span>
                                    </button>
                                  </div>
                                );
                              }

                              if (info.isAllQB) {
                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => onToggleClassification(product.name, 'NT')}
                                      className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                      title="Mudar para 100% Nota"
                                    >
                                      NT
                                    </button>
                                    <button
                                      onClick={() => onToggleClassification(product.name, 'QB')}
                                      className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-red-500 text-white border-red-600 shadow-sm shadow-red-500/20 cursor-pointer"
                                      title="100% Quebra (Clique para desmarcar)"
                                    >
                                      QB ({info.qb.toFixed(2)})
                                    </button>
                                    <button
                                      onClick={() => openSplitModal(product)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
                                      title="Dividir quantidade entre QB e NT"
                                    >
                                      <Split className="h-3.5 w-3.5 text-slate-500" />
                                      <span>Dividir</span>
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => onToggleClassification(product.name, 'NT')}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-white text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors cursor-pointer"
                                    title="Marcar tudo como Nota (NT)"
                                  >
                                    NT
                                  </button>
                                  <button
                                    onClick={() => onToggleClassification(product.name, 'QB')}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors cursor-pointer"
                                    title="Marcar tudo como Quebra (QB)"
                                  >
                                    QB
                                  </button>
                                  <button
                                    onClick={() => openSplitModal(product)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
                                    title="Escolher o quanto vai ser QB e o quanto vai ser NT"
                                  >
                                    <Split className="h-3 w-3 text-slate-500" />
                                    <span>Dividir</span>
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile responsive Cards view (shown on small screens, hidden from md up) */}
              <div className="block md:hidden space-y-4">
                {filteredAndSortedProducts.map((product) => {
                  const isChecked = selectedProducts.includes(product.name);
                  const info = getProductClassificationInfo(product);
                  return (
                    <div
                      key={product.name}
                      className={`bg-white rounded-2xl border p-5 transition-all flex flex-col gap-4 shadow-sm ${
                        isChecked ? 'border-slate-800 ring-1 ring-slate-850' : 'border-slate-100'
                      }`}
                    >
                      {/* Card Header with selection checkbox, title and unit badge */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleSelect(product.name)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 focus:outline-none shrink-0 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-5 w-5 text-slate-800" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm font-sans tracking-tight leading-snug break-all">
                            {product.name}
                          </h4>
                          <span className="inline-flex items-center justify-center mt-1.5 px-2.5 py-0.5 text-[10px] font-bold font-mono bg-slate-100 text-slate-700 rounded-md">
                            {product.type}
                          </span>
                        </div>
                      </div>

                      {/* High quality visual barcode */}
                      <div className="py-1">
                        <Barcode value={getProductCode(product.name)} />
                      </div>

                      {/* Quantitative metrics and rapid action panel */}
                      <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-sans font-semibold uppercase tracking-wider">
                              Quantidade Líquida
                            </span>
                            <span className="font-bold text-slate-950 font-mono text-base mt-0.5">
                              {product.quantity.toFixed(2)} {product.type}
                            </span>
                            {product.boxes && product.boxes > 0 && (
                              <span className="text-[9px] text-slate-500 font-sans">
                                {product.boxes} cx (Tara: -{(product.boxes * 1.75).toFixed(2)}kg)
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => openSplitModal(product)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                          >
                            <Split className="h-3.5 w-3.5" />
                            <span>Dividir QB / NT</span>
                          </button>
                        </div>

                        {/* Split Status badges if classified */}
                        {info.isSplit ? (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-green-700">NT: {info.nt.toFixed(2)} {product.type}</span>
                              <span className="text-red-700">QB: {info.qb.toFixed(2)} {product.type}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 flex overflow-hidden">
                              <div style={{ width: `${info.pctNT}%` }} className="bg-green-500 h-full" />
                              <div style={{ width: `${info.pctQB}%` }} className="bg-red-500 h-full" />
                            </div>
                          </div>
                        ) : info.isAllNT ? (
                          <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-800">
                            <span>100% Nota (NT): {info.nt.toFixed(2)} {product.type}</span>
                            <button
                              onClick={() => onToggleClassification(product.name, 'NT')}
                              className="text-[10px] text-green-700 underline cursor-pointer"
                            >
                              Desmarcar
                            </button>
                          </div>
                        ) : info.isAllQB ? (
                          <div className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800">
                            <span>100% Quebra (QB): {info.qb.toFixed(2)} {product.type}</span>
                            <button
                              onClick={() => onToggleClassification(product.name, 'QB')}
                              className="text-[10px] text-red-700 underline cursor-pointer"
                            >
                              Desmarcar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onToggleClassification(product.name, 'NT')}
                              className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors cursor-pointer"
                            >
                              100% NT
                            </button>
                            <button
                              onClick={() => onToggleClassification(product.name, 'QB')}
                              className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors cursor-pointer"
                            >
                              100% QB
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Table management action board */}
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3.5">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-slate-900/10 cursor-pointer ${
                isExporting ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              <FileDown className={`h-4.5 w-4.5 ${isExporting ? 'animate-spin' : 'animate-bounce'}`} />
              {isExporting ? 'Exportando...' : 'Exportar PDF'}
            </button>

            {selectedProducts.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold text-sm rounded-xl transition duration-150 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                Excluir Selecionados ({selectedProducts.length})
              </button>
            )}

            <button
              onClick={handleClearAllClick}
              className="flex-1 sm:flex-initial sm:ml-auto flex items-center justify-center gap-2 px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl transition duration-150 cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-slate-400" />
              Limpar Tabela
            </button>
          </div>
        </>
      )}

      {/* Interactive Split Modal for choosing how much is QB and how much is NT */}
      {splitModal.isOpen && splitModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
                  <Split className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">
                    Divisão de Quantidade (QB / NT)
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Defina o quanto do produto será <strong className="text-green-700">Nota (NT)</strong> e o quanto será <strong className="text-red-700">Quebra (QB)</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={closeSplitModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Product Summary Banner */}
            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Produto</span>
                <span className="text-sm font-bold text-slate-900">{splitModal.product.name}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quantidade Total</span>
                <span className="text-base font-black font-mono text-slate-950">
                  {splitModal.product.quantity.toFixed(2)} {splitModal.product.type}
                </span>
              </div>
            </div>

            {/* Visual Split Ratio Bar */}
            <div className="mt-5">
              <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                <span className="text-green-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                  Nota (NT): {splitModal.quantityNT.toFixed(2)} {splitModal.product.type} ({splitModal.product.quantity > 0 ? ((splitModal.quantityNT / splitModal.product.quantity) * 100).toFixed(0) : 0}%)
                </span>
                <span className="text-red-700 flex items-center gap-1.5">
                  Quebra (QB): {splitModal.quantityQB.toFixed(2)} {splitModal.product.type} ({splitModal.product.quantity > 0 ? ((splitModal.quantityQB / splitModal.product.quantity) * 100).toFixed(0) : 0}%)
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-3 flex overflow-hidden p-0.5 border border-slate-300/40">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, splitModal.product.quantity > 0 ? (splitModal.quantityNT / splitModal.product.quantity) * 100 : 0))}%` }}
                  className="bg-green-500 h-full rounded-l-full transition-all duration-150"
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, splitModal.product.quantity > 0 ? (splitModal.quantityQB / splitModal.product.quantity) * 100 : 0))}%` }}
                  className="bg-red-500 h-full rounded-r-full transition-all duration-150"
                />
              </div>

              {/* Range Slider for Quick Proportional Adjustments */}
              <div className="mt-3">
                <input
                  type="range"
                  min="0"
                  max={splitModal.product.quantity}
                  step="0.01"
                  value={splitModal.quantityNT}
                  onChange={(e) => {
                    const valNT = Number(parseFloat(e.target.value).toFixed(2));
                    const total = splitModal.product?.quantity || 0;
                    const valQB = Math.max(0, Number((total - valNT).toFixed(2)));
                    setSplitModal(prev => ({
                      ...prev,
                      quantityNT: valNT,
                      quantityQB: valQB,
                      ntInput: valNT.toFixed(2),
                      qbInput: valQB.toFixed(2),
                    }));
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5 mt-1">
                  <span>0% NT (100% QB)</span>
                  <span>50% / 50%</span>
                  <span>100% NT (0% QB)</span>
                </div>
              </div>
            </div>

            {/* Direct Input Fields with Instant Rebalancing */}
            <div className="grid grid-cols-2 gap-3.5 mt-5">
              <div className="p-3 bg-green-50/60 border border-green-200 rounded-xl">
                <label className="text-xs font-bold text-green-900 block mb-1">
                  Valor para Nota (NT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitModal.ntInput}
                    onChange={(e) => handleSplitModalNTChange(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-green-300 rounded-lg text-sm font-bold font-mono text-green-950 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-semibold text-green-700 font-mono">
                    {splitModal.product.type}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl">
                <label className="text-xs font-bold text-red-900 block mb-1">
                  Valor para Quebra (QB)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitModal.qbInput}
                    onChange={(e) => handleSplitModalQBChange(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-red-300 rounded-lg text-sm font-bold font-mono text-red-950 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-semibold text-red-700 font-mono">
                    {splitModal.product.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Atalhos Rápidos:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleSplitPreset(100)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-green-100 text-slate-700 hover:text-green-800 rounded-lg font-semibold transition-colors cursor-pointer text-center text-[11px]"
                >
                  100% NT
                </button>
                <button
                  type="button"
                  onClick={() => handleSplitPreset(75)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer text-center text-[11px]"
                >
                  75 / 25
                </button>
                <button
                  type="button"
                  onClick={() => handleSplitPreset(50)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer text-center text-[11px]"
                >
                  50 / 50
                </button>
                <button
                  type="button"
                  onClick={() => handleSplitPreset(25)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer text-center text-[11px]"
                >
                  25 / 75
                </button>
                <button
                  type="button"
                  onClick={() => handleSplitPreset(0)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-800 rounded-lg font-semibold transition-colors cursor-pointer text-center text-[11px]"
                >
                  100% QB
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitModal(prev => ({
                      ...prev,
                      quantityNT: 0,
                      quantityQB: 0,
                      ntInput: '0.00',
                      qbInput: '0.00',
                    }));
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg font-semibold transition-colors cursor-pointer text-center text-[11px]"
                >
                  Zerar
                </button>
              </div>
            </div>

            {/* Validation & Balance Info */}
            <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 text-xs flex items-center justify-between">
              <span className="text-slate-600">
                Soma da divisão: <strong className="font-mono text-slate-900">{(splitModal.quantityNT + splitModal.quantityQB).toFixed(2)}</strong> de <strong className="font-mono text-slate-900">{splitModal.product.quantity.toFixed(2)}</strong> {splitModal.product.type}
              </span>
              {Math.abs((splitModal.quantityNT + splitModal.quantityQB) - splitModal.product.quantity) <= 0.01 ? (
                <span className="text-green-600 font-bold flex items-center gap-1 text-[11px]">
                  <Check className="h-3.5 w-3.5" /> 100% distribuído
                </span>
              ) : (
                <span className="text-amber-600 font-semibold text-[11px]">
                  Diferença: {Math.abs(splitModal.product.quantity - (splitModal.quantityNT + splitModal.quantityQB)).toFixed(2)}
                </span>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2.5 mt-6">
              <button
                type="button"
                onClick={closeSplitModal}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSplit}
                className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-slate-900/10"
              >
                Salvar Divisão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal (Bypasses browser sandboxed iframe restrictions) */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-150 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                modalConfig.type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-800'
              }`}>
                {modalConfig.type === 'danger' ? <Trash2 className="h-5 w-5" /> : <Info className="h-5 w-5" />}
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
                {modalConfig.cancelText}
              </button>
              <button
                onClick={modalConfig.onConfirm}
                className={`flex-1 px-4 py-2.5 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  modalConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual PDF compiler and preview sheet (visible to user during generation) */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-slate-50 rounded-2xl max-w-4xl w-full p-6 border border-slate-200 shadow-2xl flex flex-col items-center gap-4 max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-slate-900 font-bold font-sans">
              <FileDown className="h-5 w-5 animate-spin text-slate-850" />
              <span>Gerando PDF com Códigos de Barras...</span>
            </div>
            <p className="text-xs text-slate-500 text-center -mt-2">
              A visualização na tela garante que o navegador processe todos os códigos de barras em alta fidelidade.
            </p>
 
            {/* Strict width A4 layout for precise pixel capture */}
            <div className="flex-1 w-full overflow-auto border rounded-xl p-4 flex flex-col gap-8 bg-slate-100" style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}>
              {productPages.map((pageProducts, pageIdx) => (
                <div
                  key={pageIdx}
                  id={`real-pdf-preview-sheet-page-${pageIdx}`}
                  style={{
                    width: '714px',
                    boxSizing: 'border-box',
                    minHeight: '1000px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    padding: '40px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    margin: '0 auto',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                >
                  {/* PDF Header */}
                  <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ textAlign: 'left' }}>
                      <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>Lista de Produtos Registrados</h1>
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>Sistema de Controle de Peso Líquido e Recebimento</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block' }}>Data do Registro:</span>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0f172a', fontWeight: 'bold' }}>
                        {targetDate.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#475569', fontWeight: 'bold' }}>
                        <span>Total: {tableStats.totalKg.toFixed(2)} KG</span> • <span style={{ color: '#15803d' }}>NT: {tableStats.totalNTKg.toFixed(2)} KG</span> • <span style={{ color: '#b91c1c' }}>QB: {tableStats.totalQBKg.toFixed(2)} KG</span>
                      </div>
                    </div>
                  </div>
 
                  {/* PDF Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                        <th style={{ padding: '12px', textAlign: 'left', width: '48%' }}>Produto / Código de Barras</th>
                        <th style={{ padding: '12px', textAlign: 'center', width: '14%' }}>Medida</th>
                        <th style={{ padding: '12px', textAlign: 'right', width: '22%' }}>Quantidade</th>
                        <th style={{ padding: '12px', textAlign: 'center', width: '16%' }}>Classif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageProducts.map((p, idx) => {
                        const pInfo = getProductClassificationInfo(p);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px', backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff', verticalAlign: 'middle' }}>
                            <td style={{ padding: '8px 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px', maxWidth: '340px', wordBreak: 'break-word', lineHeight: '1.2' }}>{p.name}</div>
                              <div style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '2px' }}>
                                <Barcode value={getProductCode(p.name)} height={26} width={1.2} fontSize={9} />
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '12px', color: '#475569', verticalAlign: 'middle' }}>{p.type}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', verticalAlign: 'middle' }}>
                              {p.quantity.toFixed(2)}
                              {p.boxes && p.boxes > 0 && (
                                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontFamily: 'sans-serif', fontWeight: 'normal', marginTop: '1px' }}>
                                  {p.boxes} cx (Tara: -{(p.boxes * 1.75).toFixed(2)}kg)
                                </span>
                              )}
                              {pInfo.isSplit && (
                                <span style={{ display: 'block', fontSize: '9px', fontFamily: 'sans-serif', marginTop: '2px' }}>
                                  <span style={{ color: '#15803d', fontWeight: 'bold' }}>NT: {pInfo.nt.toFixed(2)}</span>
                                  {' • '}
                                  <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>QB: {pInfo.qb.toFixed(2)}</span>
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {pInfo.isSplit ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    backgroundColor: '#f0fdf4',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    NT ({pInfo.nt.toFixed(2)})
                                  </span>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    backgroundColor: '#fef2f2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    QB ({pInfo.qb.toFixed(2)})
                                  </span>
                                </div>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  backgroundColor: pInfo.isAllNT ? '#f0fdf4' : pInfo.isAllQB ? '#fef2f2' : '#f8fafc',
                                  color: pInfo.isAllNT ? '#15803d' : pInfo.isAllQB ? '#b91c1c' : '#64748b',
                                  border: `1px solid ${pInfo.isAllNT ? '#bbf7d0' : pInfo.isAllQB ? '#fecaca' : '#e2e8f0'}`
                                }}>
                                  {pInfo.isAllNT ? 'NT' : pInfo.isAllQB ? 'QB' : '-'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
 
                  {/* PDF Footer */}
                  <div style={{ marginTop: '40px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#94a3b8' }}>
                    <span>Geração automática pelo sistema • Registro de Produtos</span>
                    <span>Pág. {pageIdx + 1} de {productPages.length}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right Floating Status Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-xl shadow-slate-950/25 border border-slate-800 animate-in slide-in-from-bottom-5 duration-350">
          <Info className="h-4 w-4 text-slate-350 shrink-0" />
          <span className="text-xs font-medium font-sans leading-none">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
