/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LaunchRecord } from './types';
import { PRODUCTS_DATABASE } from './productsData';

export const TABLE_DATE_KEY = 'registeredProductsDate';
export const LAUNCHES_KEY = 'hortibar_launches_db';

/**
 * Gets canonical product code without hyphen
 */
export function getProductCode(name: string): string {
  const cleanName = name.trim().toUpperCase();
  const match = PRODUCTS_DATABASE.find(
    p => p.name.toUpperCase() === cleanName
  );
  if (match) return match.code.replace(/-/g, '');

  // Fallback: match without measure suffix (e.g. "TOMATE LONGA VIDA" or "MACA GALA")
  const cleanNoSuffix = cleanName.replace(/\s+(KG|UN|BJ|CX|PT|SC|DZ|GF|PO)$/, '');
  const matchWithoutSuffix = PRODUCTS_DATABASE.find(
    p => p.name.toUpperCase().replace(/\s+(KG|UN|BJ|CX|PT|SC|DZ|GF|PO)$/, '') === cleanNoSuffix
  );
  if (matchWithoutSuffix) return matchWithoutSuffix.code.replace(/-/g, '');

  // Special hortifruti aliases (all with check digit, without hyphens)
  if (cleanName === 'MACA GALA' || cleanName === 'MACA GALA KG') return '0001915';
  if (cleanName === 'TOMATE LONGA VIDA' || cleanName === 'TOMATE LONGA VIDA KG') return '0067690';
  if (cleanName === 'TOMATE CAQUI' || cleanName === 'TOMATE CAQUI KG') return '0270625';
  if (cleanName === 'BATATA ASTERIX' || cleanName === 'BATATA ASTERIX KG') return '0079143';
  if (cleanName === 'BATATA BAROA' || cleanName === 'BATATA BAROA KG') return '3806838';
  if (cleanName === 'CASTANHA CAJU' || cleanName === 'CASTANHA CAJU KG') return '0078716';
  if (cleanName === 'MEXERICA MURCOTE' || cleanName === 'MEXERICA MURCOTE KG') return '0171650';
  if (cleanName === 'TAIOBA' || cleanName === 'TAIOBA UN') return '0066782';
  if (cleanName === 'ALFACE' || cleanName === 'ALFACE UN') return '0001559';

  return '0000000';
}

/**
 * Returns today's date in YYYY-MM-DD format using local time
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date into Brazilian formatted string without timezone shifts
 */
export function formatLocalDate(dateStr: string, mode: 'full' | 'short' | 'weekday' = 'short'): string {
  if (!dateStr) return '';
  // Append T12:00:00 to avoid UTC midnight timezone rollback
  const dateObj = new Date(`${dateStr}T12:00:00`);
  if (isNaN(dateObj.getTime())) return dateStr;

  if (mode === 'short') {
    return dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  if (mode === 'weekday') {
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return dateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Gets the active table date.
 * CRITICAL RULE: When products exist from a previous day, the date CANNOT be updated
 * to today's date unless all items in the table have been erased beforehand.
 */
export function getActiveTableDate(productCount: number): string {
  const savedDate = localStorage.getItem(TABLE_DATE_KEY);
  const today = getTodayDateString();

  if (productCount > 0) {
    // If table contains products and a date was already saved, preserve it strictly!
    if (savedDate) {
      return savedDate;
    }
    // If table contains products but no date was saved yet, record today and save
    localStorage.setItem(TABLE_DATE_KEY, today);
    return today;
  }

  // If table is completely empty, it resets / syncs to today's date
  if (savedDate !== today) {
    localStorage.setItem(TABLE_DATE_KEY, today);
  }
  return today;
}

/**
 * Saves or updates the active table date
 */
export function saveActiveTableDate(date: string): void {
  localStorage.setItem(TABLE_DATE_KEY, date);
}

/**
 * Resets table date to today (used when table is emptied or user explicitly resets after clearing)
 */
export function resetActiveTableDateToToday(): string {
  const today = getTodayDateString();
  localStorage.setItem(TABLE_DATE_KEY, today);
  return today;
}

/**
 * Checks whether the current table date belongs to a previous day (or past date)
 */
export function isTableDateFromPast(tableDate: string): boolean {
  if (!tableDate) return false;
  const today = getTodayDateString();
  return tableDate < today;
}

/**
 * Retrieves all stored launches from the internal database
 */
export function getAllLaunches(): LaunchRecord[] {
  try {
    const raw = localStorage.getItem(LAUNCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error('Error reading internal launches database:', e);
    return [];
  }
}

/**
 * Appends a new launch to the internal database
 */
export function addLaunchRecord(record: LaunchRecord): void {
  try {
    const list = getAllLaunches();
    list.push(record);
    localStorage.setItem(LAUNCHES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error appending launch to internal database:', e);
  }
}

/**
 * Undoes a launch record by its unique ID.
 * Returns the undone record so the active table can roll back the quantity.
 */
export function undoLaunchRecord(id: string): LaunchRecord | null {
  try {
    const list = getAllLaunches();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const record = list[idx];
    if (record.undone) {
      return null; // Already undone
    }

    list[idx] = {
      ...record,
      undone: true,
      undoneAt: Date.now(),
    };

    localStorage.setItem(LAUNCHES_KEY, JSON.stringify(list));
    return list[idx];
  } catch (e) {
    console.error('Error undoing launch record:', e);
    return null;
  }
}

/**
 * Permanently deletes or cleans a launch record from the database (admin / cleanup)
 */
export function deleteLaunchRecord(id: string): void {
  try {
    const list = getAllLaunches().filter(r => r.id !== id);
    localStorage.setItem(LAUNCHES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error deleting launch record:', e);
  }
}

/**
 * Clear all launches (with confirmation)
 */
export function clearAllLaunches(): void {
  try {
    localStorage.setItem(LAUNCHES_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Error clearing internal launches database:', e);
  }
}
