/// <reference types="vite/client" />

declare module '*.pug?raw' {
  const src: string;
  export default src;
}

declare module '*.pug?compiled' {
  const render: (locals?: Record<string, unknown>) => string;
  export default render;
}

declare module '*.styl' {
  const url: string;
  export default url;
}
