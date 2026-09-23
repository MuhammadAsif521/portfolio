import { createActionGroup, createFeature, createReducer, emptyProps, on, props } from '@ngrx/store';

export const UiActions = createActionGroup({
  source: 'UI',
  events: {
    /** Scroll-spy: a page section became the one in view. */
    'Section Entered': props<{ id: string }>(),
    'Menu Toggled': emptyProps(),
    'Menu Closed': emptyProps(),
  },
});

interface UiState {
  /** id of the section currently in view (drives the nav's active pill). */
  activeSection: string;
  menuOpen: boolean;
}

const initialState: UiState = { activeSection: 'home', menuOpen: false };

export const uiFeature = createFeature({
  name: 'ui',
  reducer: createReducer(
    initialState,
    on(UiActions.sectionEntered, (state, { id }): UiState => ({ ...state, activeSection: id })),
    on(UiActions.menuToggled, (state): UiState => ({ ...state, menuOpen: !state.menuOpen })),
    on(UiActions.menuClosed, (state): UiState => ({ ...state, menuOpen: false })),
  ),
});
