/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useId, useMemo } from 'react';
import { ArrowLeft, Trash2, FileDown, CheckSquare, Square, Calendar, Tag, AlertCircle, X, Check, Info } from 'lucide-react';
import { RegisteredProduct } from '../types';
import { PRODUCTS_DATABASE } from '../productsData';
import Barcode from './Barcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

interface ProductTableProps {
  products: RegisteredProduct[];
  onBack: () => void;
  onDeleteProducts: (names: string[]) => void;
  onClearAll: () => void;
  onToggleClassification: (name: string, classification: 'NT' | 'QB') => void;
}

export default function ProductTable({
  products,
  onBack,
  onDeleteProducts,
  onClearAll,
  onToggleClassification,
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
    const match = PRODUCTS_DATABASE.find(
      p => p.name.toUpperCase() === name.toUpperCase()
    );
    return match ? match.code : '0000000000000';
  };

  // Select all or deselect all
  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.name));
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

  // Only export selected products if there are any, otherwise export all products
  const productsToExport = selectedProducts.length > 0
    ? products.filter(p => selectedProducts.includes(p.name))
    : products;

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

  const formattedDate = new Date().toLocaleDateString('pt-BR', {
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
          <button
            onClick={onBack}
            className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Voltar para o Registro
          </button>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Produtos Registrados
          </h2>
        </div>

        {/* Date visual pill */}
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
                      {selectedProducts.length === products.length ? (
                        <CheckSquare className="h-4 w-4 text-slate-800" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                    Produto / Código de Barras
                  </th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center font-sans w-24">
                    Unidade
                  </th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right font-sans w-32">
                    Quantidade Líquida
                  </th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center font-sans w-40">
                    Classificação (NT / QB)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
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

                      {/* Interactive classification buttons with persistence */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onToggleClassification(product.name, 'NT')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                              product.classification === 'NT'
                                ? 'bg-green-500 text-white border-green-600 shadow-sm shadow-green-500/20'
                                : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                            title={product.classification === 'NT' ? 'Desmarcar Nota' : 'Marcar como Nota de Devolução'}
                          >
                            NT
                          </button>
                          <button
                            onClick={() => onToggleClassification(product.name, 'QB')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                              product.classification === 'QB'
                                ? 'bg-red-500 text-white border-red-600 shadow-sm shadow-red-500/20'
                                : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                            title={product.classification === 'QB' ? 'Desmarcar Quebra' : 'Marcar como Quebra'}
                          >
                            QB
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive Cards view (shown on small screens, hidden from md up) */}
          <div className="block md:hidden space-y-4">
            {products.map((product) => {
              const isChecked = selectedProducts.includes(product.name);
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
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-sans font-semibold uppercase tracking-wider">
                        Quantidade Líquida
                      </span>
                      <span className="font-bold text-slate-950 font-mono text-sm mt-0.5">
                        {product.quantity.toFixed(2)}
                      </span>
                      {product.boxes && product.boxes > 0 && (
                        <span className="text-[9px] text-slate-500 font-sans">
                          {product.boxes} cx (Tara: -{(product.boxes * 1.75).toFixed(2)}kg)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onToggleClassification(product.name, 'NT')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                          product.classification === 'NT'
                            ? 'bg-green-500 text-white border-green-600 shadow-sm shadow-green-500/20'
                            : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        NT
                      </button>
                      <button
                        onClick={() => onToggleClassification(product.name, 'QB')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                          product.classification === 'QB'
                            ? 'bg-red-500 text-white border-red-600 shadow-sm shadow-red-500/20'
                            : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        QB
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block' }}>Data de Emissão:</span>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0f172a', fontWeight: 'bold' }}>
                        {new Date().toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
 
                  {/* PDF Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                        <th style={{ padding: '12px', textAlign: 'left', width: '50%' }}>Produto / Código de Barras</th>
                        <th style={{ padding: '12px', textAlign: 'center', width: '15%' }}>Medida</th>
                        <th style={{ padding: '12px', textAlign: 'right', width: '20%' }}>Quantidade</th>
                        <th style={{ padding: '12px', textAlign: 'center', width: '15%' }}>Classif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageProducts.map((p, idx) => (
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
                                {p.boxes} cx
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              backgroundColor: p.classification === 'NT' ? '#f0fdf4' : p.classification === 'QB' ? '#fef2f2' : '#f8fafc',
                              color: p.classification === 'NT' ? '#15803d' : p.classification === 'QB' ? '#b91c1c' : '#64748b',
                              border: `1px solid ${p.classification === 'NT' ? '#bbf7d0' : p.classification === 'QB' ? '#fecaca' : '#e2e8f0'}`
                            }}>
                              {p.classification || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
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
