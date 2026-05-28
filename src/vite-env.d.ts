/// <reference types="vite/client" />

declare const __LEVEL_EDITOR_ENABLED__: boolean;

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
