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
}
