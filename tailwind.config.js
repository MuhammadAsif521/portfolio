/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['selector', '[data-theme="dark"]'],
    content: [
        './projects/cusadmin/src/**/*.{html,ts}',
        './projects/website/src/**/*.{html,ts}',
        './projects/**/*.{html,ts}',
        './src/**/*.{html,ts}',
    ],
    theme: {
        extend: {
        },
    },
    plugins: [],
};