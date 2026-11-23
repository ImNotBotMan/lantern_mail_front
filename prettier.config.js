export default {
  semi: false,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
  // Сортирует Tailwind-классы в одном порядке (раскладка → размеры → цвет → состояния).
  // Классы берутся из нашей темы, поэтому плагину нужен входной CSS; `cn` — склейка классов.
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/shared/ui/global.css',
  tailwindFunctions: ['cn'],
}
