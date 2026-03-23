/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './node_modules/heroui-native/lib/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        commune: {
          paper: '#f5f1ea',
          primary: '#2d6a4f',
          'primary-strong': '#1b4332',
          forest: '#1f2330',
          ink: '#171b24',
          'ink-soft': '#667085',
          sage: '#d7e6dd',
          peach: '#efdccf',
          lilac: '#e8e1ef',
          gold: '#f1e5bf',
          coral: '#eaa681',
        },
        accent: {
          DEFAULT: '#2d6a4f',
          bright: '#4ade80',
          surface: '#EEF6F3',
        },
      },
    },
  },
  plugins: [],
};
