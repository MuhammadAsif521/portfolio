/** @type {import('tailwindcss').Config} */

// Tailwind colours point at the CSS custom properties in projects/shared/src/lib/styles/_variables.scss,
// so `bg-primary`, `text-heading`, `bg-band-dark`… follow the admin-selected Theme and light/dark mode.
// Colours go through color-mix() with Tailwind's <alpha-value>, so opacity modifiers work too (`bg-primary/10`).
const token = (name) => `var(--${name})`;
const color = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

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
                    DEFAULT: color('primary'),
                    hover: color('primary-hover'),
                    active: color('primary-active'),
                    soft: token('primary-soft'),
                    muted: token('primary-muted'),
                    container: token('primary-soft'),
                },
                secondary: { DEFAULT: color('secondary'), hover: color('secondary-hover') },
                accent: color('accent'),
                'on-primary': { DEFAULT: color('on-primary'), container: color('form-chip-text') },
                'on-secondary': color('on-secondary'),
                'on-accent': color('on-accent'),
                'on-error': '#ffffff',

                body: color('body-bg'),
                'band-a': color('band-a'),
                'band-b': color('band-b'),
                band: {
                    dark: color('band-dark'),
                    'dark-raised': color('band-dark-raised'),
                    'dark-text': color('band-dark-text'),
                    'dark-muted': color('band-dark-muted'),
                    'dark-border': color('band-dark-border'),
                },
                surface: {
                    DEFAULT: color('surface'),
                    muted: color('surface-muted'),
                    // Material-style names used by the shared components (stepper, cropper…)
                    container: color('surface-muted'),
                    'container-high': color('surface-muted'),
                    'container-highest': color('border'),
                },
                card: color('card-bg'),

                heading: color('heading'),
                text: {
                    DEFAULT: color('text'),
                    muted: color('text-muted'),
                    secondary: color('text-muted'),
                },
                muted: color('text-muted'),
                subtle: color('text-subtle'),
                inverse: color('text-inverse'),

                border: { DEFAULT: color('border'), strong: color('border-strong'), color: color('border') },
                divider: color('divider'),

                error: { DEFAULT: color('error'), soft: token('error-soft') },
                warning: { DEFAULT: color('warning'), soft: token('warning-soft') },
                success: { DEFAULT: color('success'), soft: token('success-soft') },
                info: { DEFAULT: color('info'), soft: token('info-soft') },
                green: { DEFAULT: color('success') },
                yellow: { DEFAULT: color('warning') },

                // Legacy names still used in shared component templates, mapped onto the current tokens.
                color: color('border'),
                active: color('primary'),
                editor: color('text'),
                field: color('form-control-bg'),
                background: color('surface-muted'),
                bg: { muted: color('surface-muted'), surface: color('surface') },
                'btn-primary': { DEFAULT: color('primary'), dark: color('primary-hover') },
                'on-surface': { DEFAULT: color('heading'), variant: color('text-muted') },
                'outline-variant': color('border'),
            },
            transitionDuration: {
                base: token('duration-normal'),
                fast: token('duration-fast'),
                slow: token('duration-slow'),
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
