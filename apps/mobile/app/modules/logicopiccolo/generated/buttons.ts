export type ButtonAsset = {
  id: string;
  label: string;
  color: string;
  svgXml: string;
};

export const frameButtons: ButtonAsset[] = [
  {
    id: 'B1',
    label: '1',
    color: '#ef4444',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Red button">
  <circle cx="32" cy="32" r="29" fill="#E74C3C" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'B2',
    label: '2',
    color: '#16a34a',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Green button">
  <circle cx="32" cy="32" r="29" fill="#2ECC71" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'B3',
    label: '3',
    color: '#2563eb',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Blue button">
  <circle cx="32" cy="32" r="29" fill="#3498DB" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'B4',
    label: '4',
    color: '#f59e0b',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Yellow button">
  <circle cx="32" cy="32" r="29" fill="#F1C40F" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'B5',
    label: '5',
    color: '#f97316',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Orange button">
  <circle cx="32" cy="32" r="29" fill="#E67E22" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'B6',
    label: '6',
    color: '#ef4444',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Red button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#E74C3C" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'B7',
    label: '7',
    color: '#16a34a',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Green button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#2ECC71" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'B8',
    label: '8',
    color: '#2563eb',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Blue button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#3498DB" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'B9',
    label: '9',
    color: '#f59e0b',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Yellow button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#F1C40F" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'B10',
    label: '0',
    color: '#f97316',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Orange button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#E67E22" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  }
];
