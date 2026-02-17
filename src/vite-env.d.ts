/// <reference types="vite/client" />

// Allow importing CSS modules
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
