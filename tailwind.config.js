/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
            },
            colors: {
                charcoal: '#1a1a1a',
                cream: '#fdfbf7',
                'fw-dark': '#0e0e0e',
                'fw-card': '#141210',
                'fw-surface': '#1a1a18',
                'fw-panel': '#1e1a15',
                'fw-gold': '#c9a84c',
                'fw-text': '#e8e2d9',
                'fw-muted': '#9a8e7d',
                'fw-dim': '#5a5248',
            },
            animation: {
                'slow-drift': 'slow-drift 20s ease-in-out infinite alternate',
            },
            keyframes: {
                'slow-drift': {
                    '0%': { transform: 'scale(1.1) translate(0, 0)' },
                    '100%': { transform: 'scale(1.15) translate(-2%, -1%)' },
                },
            },
        },
    },
    plugins: [],
}
