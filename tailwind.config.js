/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'jw-blue': '#4a6da7',
                'jw-tesouros': '#626367',
                'jw-ministerio': '#c18626',
                'jw-vida': '#942926',
            }
        },
    },
    plugins: [],
}