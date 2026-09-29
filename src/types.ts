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
  classification?: 'NT' | 'QB' | '';
  boxes?: number;
  originalWeight?: number;
  timestamp: number;
  launchCount?: number;
}

export interface LaunchRecord {
  id: string;
  timestamp: number;
  productName: string;
  productCode: string;
  type: string;
  quantity: number; // Net quantity in this launch
  boxes?: number; // Boxes in this launch
  originalWeight?: number; // Gross weight in this launch
  tareWeight?: number; // boxes * 1.75
}
