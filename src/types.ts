/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductTemplate {
  code: string;
  name: string;
  type: string;
}

export interface RegisteredProduct {
  name: string;
  type: string;
  quantity: number;
  classification?: 'NT' | 'QB' | 'SPLIT' | '';
  quantityNT?: number;
  quantityQB?: number;
  boxes?: number;
  originalWeight?: number;
  timestamp: number;
}

export interface ProductLaunchEntry {
  id: string;
  productName: string;
  type: string;
  inputQuantity: number;
  boxes?: number;
  tareWeight?: number;
  netQuantity: number;
  classification?: 'NT' | 'QB' | 'SPLIT' | '';
  quantityNT?: number;
  quantityQB?: number;
  timestamp: number;
}

export interface LaunchRecord {
  id: string;
  name: string;
  productName?: string;
  type: string;
  date: string;
  timestamp: number;
  inputQuantity?: number;
  quantity: number;
  originalWeight?: number;
  boxes?: number;
  tareWeight?: number;
  netQuantity?: number;
  undone?: boolean;
  undoneAt?: number;
  classification?: 'NT' | 'QB' | 'SPLIT' | '';
  quantityNT?: number;
  quantityQB?: number;
}
