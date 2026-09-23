/** @type {import('tailwindcss').Config} */

// Tailwind colours point at the CSS custom properties in projects/shared/src/lib/styles/_variables.scss,
// so `bg-primary`, `text-heading`, `bg-band-dark`… follow the admin-selected Theme and light/dark mode.
// Opacity modifiers (`bg-primary/20`) don't work with var() colours in Tailwind 3; use the *-soft tokens.
const token = (name) => `var(--${name})`;

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
            colors: {
                primary: {
                    DEFAULT: token('primary'),
                    hover: token('primary-hover'),
                    active: token('primary-active'),
                    soft: token('primary-soft'),
                    muted: token('primary-muted'),
                },
                secondary: { DEFAULT: token('secondary'), hover: token('secondary-hover') },
                accent: token('accent'),
                'on-primary': token('on-primary'),
                'on-secondary': token('on-secondary'),
                'on-accent': token('on-accent'),

                body: token('body-bg'),
                'band-a': token('band-a'),
                'band-b': token('band-b'),
                band: {
                    dark: token('band-dark'),
                    'dark-raised': token('band-dark-raised'),
                    'dark-text': token('band-dark-text'),
                    'dark-muted': token('band-dark-muted'),
                    'dark-border': token('band-dark-border'),
                },
                surface: { DEFAULT: token('surface'), muted: token('surface-muted') },
                card: token('card-bg'),

                heading: token('heading'),
                text: token('text'),
                muted: token('text-muted'),
                subtle: token('text-subtle'),
                inverse: token('text-inverse'),

                border: { DEFAULT: token('border'), strong: token('border-strong') },
                divider: token('divider'),

                error: { DEFAULT: token('error'), soft: token('error-soft') },
                warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
                success: { DEFAULT: token('success'), soft: token('success-soft') },
                info: { DEFAULT: token('info'), soft: token('info-soft') },
            },
            fontFamily: {
                sans: token('font-body'),
                heading: token('font-heading'),
                mono: token('font-mono'),
            },
            fontSize: {
                display: [token('text-display'), { lineHeight: '1.05', letterSpacing: '-0.02em' }],
            },
            borderRadius: {
                xs: token('radius-xs'),
                sm: token('radius-sm'),
                md: token('radius-md'),
                lg: token('radius-lg'),
                xl: token('radius-xl'),
                '2xl': token('radius-2xl'),
                band: token('radius-band'),
                pill: token('radius-pill'),
            },
            boxShadow: {
                xs: token('shadow-xs'),
                sm: token('shadow-sm'),
                md: token('shadow-md'),
                lg: token('shadow-lg'),
                focus: token('focus-ring'),
            },
            backgroundImage: {
                brand: token('brand-gradient'),
            },
            maxWidth: {
                container: token('container-max'),
            },
            spacing: {
                gutter: token('container-gutter'),
                section: token('section-space'),
                header: token('header-height'),
            },
            transitionTimingFunction: {
                out: token('ease-out'),
                'in-out': token('ease-in-out'),
            },
            zIndex: {
                dropdown: token('z-dropdown'),
                sticky: token('z-sticky'),
                overlay: token('z-overlay'),
                modal: token('z-modal'),
                toast: token('z-toast'),
            },
        },
    },
    plugins: [],
};
