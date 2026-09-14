import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<section
  class="mx-auto flex w-fit items-center justify-center p-4"
  [style.min-height.px]="height()"
  role="status"
  aria-live="polite"
>
   <div
      class="relative w-full max-w-[760px] overflow-hidden rounded-[32px] border border-border bg-field p-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-12"
   >
      <!-- Decorative background -->
      <div
         class="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/3 rounded-full bg-secondary/10 blur-3xl"
      ></div>

      <div class="relative z-10 text-center">
         <!-- Empty-state illustration --> 
            <svg
               class="mx-auto block h-auto max-w-full"
               width="480"
               height="350"
               viewBox="0 0 480 400"
               fill="none"
               xmlns="http://www.w3.org/2000/svg"
            >
               <defs>
                  <linearGradient id="e" x1="0" y1="0" x2="1" y2="1">
                     <stop offset="0%" stop-color="#fdb515" />
                     <stop offset="100%" stop-color="#f7941e" />
                  </linearGradient>
                  <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stop-color="#33342f" />
                     <stop offset="100%" stop-color="#232420" />
                  </linearGradient>
                  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stop-color="#2a2b27" />
                     <stop offset="100%" stop-color="#1d1e1b" />
                  </linearGradient>
                  <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stop-color="#4a4b45" />
                     <stop offset="100%" stop-color="#3a3b36" />
                  </linearGradient>
                  <radialGradient id="a" cx=".5" cy=".5" r=".5">
                     <stop
                        offset="0%"
                        stop-color="#f7941e"
                        stop-opacity=".14"
                     />
                     <stop
                        offset="100%"
                        stop-color="#f7941e"
                        stop-opacity="0"
                     />
                  </radialGradient>
               </defs>
               <ellipse cx="240" cy="210" rx="185" ry="150" fill="url(#a)" />
               <circle
                  cx="240"
                  cy="205"
                  r="138"
                  stroke="#4a4b45"
                  stroke-width="1.6"
                  stroke-dasharray="5 9"
                  opacity=".7"
               />
               <circle cx="240" cy="67" r="4" fill="#f7941e" />
               <circle cx="371" cy="252" r="3.5" fill="#5a5b54" />
               <circle cx="112" cy="266" r="3.5" fill="#5a5b54" />
               <path
                  d="m96 118 4.5 11 11 4.5-11 4.5-4.5 11-4.5-11-11-4.5 11-4.5z"
                  fill="#fdb515"
                  opacity=".9"
               />
               <path
                  d="m392 138 3.4 8.2 8.2 3.4-8.2 3.4-3.4 8.2-3.4-8.2-8.2-3.4 8.2-3.4z"
                  fill="#f7941e"
                  opacity=".55"
               />
               <path
                  d="m348 84 2.4 5.8 5.8 2.4-5.8 2.4-2.4 5.8-2.4-5.8-5.8-2.4 5.8-2.4z"
                  fill="#6a6b63"
                  opacity=".8"
               />
               <path
                  d="M142 176h60a12 12 0 0 1 9.6 4.8l9.8 13a12 12 0 0 0 9.6 4.8h107a14 14 0 0 1 14 14v96a14 14 0 0 1-14 14H156a14 14 0 0 1-14-14z"
                  fill="url(#b)"
                  stroke="#454641"
                  stroke-width="1.5"
               />
               <g transform="rotate(-4 247 196)">
                  <rect
                     x="182"
                     y="168"
                     width="130"
                     height="86"
                     rx="8"
                     fill="url(#c)"
                     stroke="#55564f"
                     stroke-width="1.4"
                  />
                  <rect
                     x="196"
                     y="184"
                     width="66"
                     height="7"
                     rx="3.5"
                     fill="#6b6c64"
                  />
                  <rect
                     x="196"
                     y="199"
                     width="96"
                     height="6"
                     rx="3"
                     fill="#5b5c55"
                  />
                  <rect
                     x="196"
                     y="212"
                     width="80"
                     height="6"
                     rx="3"
                     fill="#5b5c55"
                  />
               </g>
               <g transform="rotate(5 300 200)">
                  <rect
                     x="252"
                     y="172"
                     width="110"
                     height="76"
                     rx="8"
                     fill="#43443e"
                     stroke="#55564f"
                     stroke-width="1.4"
                  />
                  <rect
                     x="266"
                     y="188"
                     width="52"
                     height="7"
                     rx="3.5"
                     fill="#63645c"
                  />
                  <rect
                     x="266"
                     y="203"
                     width="76"
                     height="6"
                     rx="3"
                     fill="#565750"
                  />
               </g>
               <path
                  d="M132 238a14 14 0 0 1 13.6-10.6h198.8a14 14 0 0 1 13.6 17.4l-19 66a14 14 0 0 1-13.6 10.2H160a14 14 0 0 1-13.6-17.4z"
                  fill="url(#d)"
                  stroke="#4c4d47"
                  stroke-width="1.5"
               />
               <rect
                  x="196"
                  y="252"
                  width="120"
                  height="48"
                  rx="10"
                  stroke="#f7941e"
                  stroke-width="1.8"
                  stroke-dasharray="6 6"
                  opacity=".85"
               />
               <path
                  d="M256 266v20m-10-10h20"
                  stroke="#f7941e"
                  stroke-width="2.6"
                  stroke-linecap="round"
               />
               <path
                  d="M146 231h198"
                  stroke="#5a5b54"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  opacity=".6"
               />
               <g transform="rotate(-6 208 116)">
                  <rect
                     x="150"
                     y="98"
                     width="118"
                     height="38"
                     rx="19"
                     fill="url(#e)"
                  />
                  <circle cx="172" cy="117" r="7" fill="#1a1a17" />
                  <rect
                     x="188"
                     y="112"
                     width="62"
                     height="9"
                     rx="4.5"
                     fill="#1a1a17"
                     opacity=".85"
                  />
               </g>
               <g transform="rotate(7 306 96)">
                  <rect
                     x="256"
                     y="78"
                     width="102"
                     height="34"
                     rx="17"
                     fill="#2e2f2a"
                     stroke="#4c4d47"
                     stroke-width="1.4"
                  />
                  <circle cx="276" cy="95" r="6" fill="#f7941e" />
                  <rect
                     x="290"
                     y="91"
                     width="50"
                     height="8"
                     rx="4"
                     fill="#6b6c64"
                  />
               </g>
               <g transform="rotate(-12 120 208)">
                  <path
                     d="M104 196h22a6 6 0 0 1 6 6v10a6 6 0 0 1-1.8 4.3l-15 14.6a6 6 0 0 1-8.4 0l-11-11a6 6 0 0 1 0-8.5l14-13.7a6 6 0 0 1 4.2-1.7z"
                     fill="#2e2f2a"
                     stroke="#f7941e"
                     stroke-width="1.8"
                  />
                  <circle cx="122" cy="207" r="3.4" fill="#f7941e" />
               </g>
               <ellipse
                  cx="240"
                  cy="336"
                  rx="132"
                  ry="12"
                  fill="#000"
                  opacity=".35"
               />
            </svg> 

         <!-- Content -->
         <div class="mx-auto max-w-[540px]">
            <h3
               class="m-0 font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-text sm:text-3xl"
            >
               {{ subtitle() }}
            </h3>

            <p
               class="mx-auto mt-3 max-w-[480px] font-body text-sm leading-7 text-secondary sm:text-[15px]"
            >
               {{ displayMessage() }}
            </p>
         </div>

         <!-- Optional actions -->
         <div
            class="mt-7 flex flex-wrap items-center justify-center gap-3 empty:hidden"
         >
            <ng-content />
         </div>
      </div>
   </div>
</section>

  `,
})
export class EmptyStateComponent {
  readonly subtitle = input<string>('Nothing here yet!');
  readonly message = input<string>('');
  readonly height = input<number>(600);

  readonly displayMessage = () =>
    this.message().trim() ||
    'There is currently no content available. Please check back again later.';
}