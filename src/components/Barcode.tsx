/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';

interface BarcodeProps {
  value: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
  fontSize?: number;
}

const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "233111"
];

export default function Barcode({
  value,
  height = 40,
  width = 1.2,
  displayValue = true,
  fontSize = 11,
}: BarcodeProps) {
  const svgDataUrl = useMemo(() => {
    if (!value) return '';

    try {
      // 1. Encode value in Code 128 Set B
      const codes: number[] = [104]; // Start B
      let sum = 104;

      for (let i = 0; i < value.length; i++) {
        let code = value.charCodeAt(i) - 32;
        if (code < 0 || code > 95) {
          code = 0; // fallback to space
        }
        codes.push(code);
        sum += code * (i + 1);
      }

      const checksum = sum % 103;
      codes.push(checksum);
      codes.push(106); // Stop

      // 2. Generate binary representation (1 for bar, 0 for space)
      let binary = "";
      for (let i = 0; i < codes.length; i++) {
        const val = codes[i];
        let pattern = PATTERNS[val];
        if (val === 106) {
          pattern = "2331112"; // Stop pattern with termination bar
        }
        for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
          const w = parseInt(pattern[pIdx], 10);
          const symbol = pIdx % 2 === 0 ? "1" : "0";
          binary += symbol.repeat(w);
        }
      }

      // 3. Compress consecutive bars into rect positions to optimize SVG elements count
      const rects: { x: number; width: number }[] = [];
      let currentBarStart = -1;

      for (let x = 0; x < binary.length; x++) {
        if (binary[x] === '1') {
          if (currentBarStart === -1) {
            currentBarStart = x;
          }
        } else {
          if (currentBarStart !== -1) {
            rects.push({
              x: currentBarStart,
              width: x - currentBarStart,
            });
            currentBarStart = -1;
          }
        }
      }
      if (currentBarStart !== -1) {
        rects.push({
          x: currentBarStart,
          width: binary.length - currentBarStart,
        });
      }

      const margin = 6;
      const textHeight = displayValue ? fontSize + 4 : 0;
      const canvasWidth = binary.length * width + margin * 2;
      const canvasHeight = height + textHeight + margin * 2;

      // Build SVG elements
      const rectsSvg = rects.map(rect => {
        const rx = margin + rect.x * width;
        const rwidth = rect.width * width;
        return `<rect x="${rx}" y="${margin}" width="${rwidth}" height="${height}" fill="#000000" />`;
      }).join('\n');

      const textSvg = displayValue ? `
        <text
          x="${canvasWidth / 2}"
          y="${height + margin + fontSize}"
          fill="#000000"
          font-family="monospace"
          font-size="${fontSize}"
          font-weight="bold"
          text-anchor="middle"
        >
          ${value}
        </text>
      ` : '';

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
        <rect width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff" />
        ${rectsSvg}
        ${textSvg}
      </svg>`;

      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    } catch (err) {
      console.error('Custom Barcode encoding error:', err);
      return '';
    }
  }, [value, height, width, displayValue, fontSize]);

  return (
    <div 
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '4px',
        borderRadius: '6px',
        maxWidth: '180px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        border: '1px solid #f1f5f9',
        minHeight: `${height + (displayValue ? fontSize + 12 : 8)}px`
      }}
    >
      {svgDataUrl ? (
        <img 
          src={svgDataUrl} 
          alt={`Barcode ${value}`} 
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }} 
        />
      ) : (
        <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'sans-serif' }}>Gerando...</div>
      )}
    </div>
  );
}

