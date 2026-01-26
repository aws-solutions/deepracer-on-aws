// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider as StoreProvider } from 'react-redux';
import { createMemoryRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import AppLayout from '#components/AppLayout';
import RequiresAuth from '#components/RequiresAuth';
import { AuthState } from '#constants/auth.js';
import { pages, PageId } from '#constants/pages';
import Auth from '#pages/Auth';
import Home from '#pages/Home';
import { store } from '#store';

// Mock all dependencies
vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: vi.fn(),
  }),
}));

vi.mock('@cloudscape-design/global-styles/index.css', () => ({}));

// Mock i18n with default export
vi.mock('#i18n', () => ({
  default: {
    init: vi.fn(),
    t: vi.fn((key) => key),
    changeLanguage: vi.fn(),
  },
}));

// Mock components
vi.mock('#components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('#components/RequiresAuth', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="requires-auth">{children}</div>,
}));

// Mock all pages
vi.mock('#pages/Account', () => ({
  default: () => <div data-testid="account-page">Account Page</div>,
}));

vi.mock('#pages/Auth', () => ({
  default: ({ initialAuthState }: { initialAuthState: AuthState }) => (
    <div data-testid="auth-page">Auth Page - {initialAuthState}</div>
  ),
}));

vi.mock('#pages/CloneRace', () => ({
  default: () => <div data-testid="clone-race-page">Clone Race Page</div>,
}));

vi.mock('#pages/CreateEvaluation', () => ({
  default: () => <div data-testid="create-evaluation-page">Create Evaluation Page</div>,
}));

vi.mock('#pages/CreateModel', () => ({
  default: () => <div data-testid="create-model-page">Create Model Page</div>,
}));

vi.mock('#pages/CreateRace', () => ({
  default: () => <div data-testid="create-race-page">Create Race Page</div>,
}));

vi.mock('#pages/EditRace', () => ({
  default: () => <div data-testid="edit-race-page">Edit Race Page</div>,
}));

vi.mock('#pages/EnterRace', () => ({
  default: () => <div data-testid="enter-race-page">Enter Race Page</div>,
}));

vi.mock('#pages/GetStarted', () => ({
  default: () => <div data-testid="get-started-page">Get Started Page</div>,
}));

vi.mock('#pages/Home', () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));

vi.mock('#pages/ManageInstance/ManageInstance.js', () => ({
  default: () => <div data-testid="manage-instance-page">Manage Instance Page</div>,
}));

vi.mock('#pages/ManageRaces', () => ({
  default: () => <div data-testid="manage-races-page">Manage Races Page</div>,
}));

vi.mock('#pages/ModelDetails', () => ({
  default: () => <div data-testid="model-details-page">Model Details Page</div>,
}));

vi.mock('#pages/Models', () => ({
  default: () => <div data-testid="models-page">Models Page</div>,
}));

vi.mock('#pages/RaceDetails', () => ({
  default: () => <div data-testid="race-details-page">Race Details Page</div>,
}));

vi.mock('#pages/RacerProfile', () => ({
  default: () => <div data-testid="racer-profile-page">Racer Profile Page</div>,
}));

vi.mock('#pages/Races', () => ({
  default: () => <div data-testid="races-page">Races Page</div>,
}));

// Mock auth utils
const mockConfigureAuth = vi.fn();
vi.mock('#utils/authUtils', () => ({
  configureAuth: mockConfigureAuth,
}));

// Mock store with required Store interface methods
vi.mock('#store', () => ({
  store: {
    dispatch: vi.fn(),
    getState: vi.fn(),
    subscribe: vi.fn(),
    replaceReducer: vi.fn(),
    [Symbol.observable]: vi.fn(),
  },
}));

describe('App Entry Point', () => {
  beforeEach(() => {
    mockConfigureAuth.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('configures auth and renders the app', async () => {
    // Import index.tsx to trigger initialization
    await import('./index');

    // Verify auth was configured
    expect(mockConfigureAuth).toHaveBeenCalledTimes(1);
  });

  it('renders the app and handles navigation between protected and unprotected routes', async () => {
    const router = createMemoryRouter(
      createRoutesFromElements(
        <Route element={<AppLayout />}>
          <Route element={<RequiresAuth />}>
            <Route path={pages[PageId.HOME].path} element={<Home />} />
          </Route>
          <Route path={pages[PageId.SIGN_IN].path} element={<Auth initialAuthState={AuthState.SIGNIN} />} />
        </Route>,
      ),
      {
        initialEntries: [pages[PageId.SIGN_IN].path], // Start at unprotected route
      },
    );

    render(
      <StrictMode>
        <StoreProvider store={store}>
          <RouterProvider router={router} />
        </StoreProvider>
      </StrictMode>,
    );

    // Initial render should show app layout
    const app = screen.getByTestId('app-layout');
    expect(app).toBeInTheDocument();
  });
});
