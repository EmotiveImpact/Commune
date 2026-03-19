/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        commune: {
          paper: '#f5f1ea',
          'paper-strong': '#ffffff',
          'paper-soft': '#fbf7f1',
          mist: '#d9ebe5',
          sage: '#d7e6dd',
          primary: '#2d6a4f',
          'primary-strong': '#1b4332',
          forest: '#1f2330',
          'forest-soft': '#323847',
          ink: '#171b24',
          'ink-soft': '#667085',
          peach: '#efdccf',
          lilac: '#e8e1ef',
          gold: '#f1e5bf',
          coral: '#eaa681',
        },
        primary: { DEFAULT: '#2d6a4f', light: '#d7e6dd', dark: '#1b4332' },
        surface: { DEFAULT: '#ffffff', secondary: '#fbf7f1' },
      },
    },
  },
  plugins: [],
};
