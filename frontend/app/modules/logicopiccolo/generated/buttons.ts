export type ButtonAsset = {
  id: string;
  label: string;
  color: string;
  svgXml: string;
};

export const frameButtons: ButtonAsset[] = [
  {
    id: 'red-solid',
    label: 'Red',
    color: '#ef4444',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Red button">
  <circle cx="32" cy="32" r="29" fill="#E74C3C" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'green-solid',
    label: 'Green',
    color: '#16a34a',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Green button">
  <circle cx="32" cy="32" r="29" fill="#2ECC71" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'blue-solid',
    label: 'Blue',
    color: '#2563eb',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Blue button">
  <circle cx="32" cy="32" r="29" fill="#3498DB" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'yellow-solid',
    label: 'Yellow',
    color: '#f59e0b',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Yellow button">
  <circle cx="32" cy="32" r="29" fill="#F1C40F" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'orange-solid',
    label: 'Orange',
    color: '#f97316',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Orange button">
  <circle cx="32" cy="32" r="29" fill="#E67E22" stroke="#333" stroke-width="2"/>
</svg>
`,
  },
  {
    id: 'red-ring',
    label: 'Red Ring',
    color: '#ef4444',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Red button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#E74C3C" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'green-ring',
    label: 'Green Ring',
    color: '#16a34a',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Green button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#2ECC71" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'blue-ring',
    label: 'Blue Ring',
    color: '#2563eb',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Blue button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#3498DB" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'yellow-ring',
    label: 'Yellow Ring',
    color: '#f59e0b',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Yellow button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#F1C40F" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  },
  {
    id: 'orange-ring',
    label: 'Orange Ring',
    color: '#f97316',
    svgXml: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Orange button with white center circle">
  <circle cx="32" cy="32" r="29" fill="#E67E22" stroke="#333" stroke-width="2"/>
  <circle cx="32" cy="32" r="11" fill="#FFFFFF" stroke="#999" stroke-width="1.2"/>
</svg>
`,
  }
];
