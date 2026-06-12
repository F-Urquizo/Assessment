import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockAuthProvider } from './MockAuthProvider';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { MyListingsProvider } from './MyListingsProvider';
import { useMyListings, type GarageBridge } from './MyListingsContext';

const LOGGED_OUT: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  loading: false,
  accessToken: null,
  login: async () => {},
  logout: async () => {},
};

const GARAGE_CAR: GarageBridge = {
  payload: {
    manufacturer: 'acura',
    model: 'tlx',
    year: '2021',
    odometer: '40000',
    cylinders: '4',
    condition: 'excellent',
    fuel: 'gas',
    title_status: 'clean',
    transmission: 'automatic',
    drive: 'fwd',
    type: 'sedan',
    paint_color: 'white',
    state: 'ca',
    annual_miles: 12000,
  },
  estimate: 22000,
  low: 20000,
  high: 24000,
};

function Probe() {
  const { myListings, setField, save, remove } = useMyListings();
  return (
    <div>
      <span data-testid="count">{myListings.length}</span>
      <button
        onClick={() => {
          setField('model', 'civic');
          setField('askingPrice', '15000');
        }}
      >
        fill
      </button>
      <button onClick={() => save()}>save</button>
      <button onClick={() => myListings[0] && remove(myListings[0].id)}>
        remove
      </button>
    </div>
  );
}

describe('MyListingsProvider', () => {
  it('creates a listing from the form and removes it (optimistic, offline-safe)', async () => {
    render(
      <MockAuthProvider>
        <MyListingsProvider>
          <Probe />
        </MyListingsProvider>
      </MockAuthProvider>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('0');

    await userEvent.click(screen.getByText('fill'));
    await userEvent.click(screen.getByText('save'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    await userEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('rejects a save with no asking price', async () => {
    function BadProbe() {
      const { myListings, setField, save } = useMyListings();
      return (
        <div>
          <span data-testid="count">{myListings.length}</span>
          <button
            onClick={() => {
              setField('model', 'civic');
              setField('askingPrice', '');
            }}
          >
            fill
          </button>
          <button onClick={() => save()}>save</button>
        </div>
      );
    }
    render(
      <MockAuthProvider>
        <MyListingsProvider>
          <BadProbe />
        </MyListingsProvider>
      </MockAuthProvider>,
    );
    await userEvent.click(screen.getByText('fill'));
    await userEvent.click(screen.getByText('save'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('refuses to create a listing when logged out (no false success)', async () => {
    function GuardProbe() {
      const { myListings, setField, save } = useMyListings();
      const [error, setError] = useState<string | null>(null);
      return (
        <div>
          <span data-testid="count">{myListings.length}</span>
          <span data-testid="error">{error}</span>
          <button
            onClick={() => {
              setField('model', 'civic');
              setField('askingPrice', '15000');
            }}
          >
            fill
          </button>
          <button onClick={() => setError(save().error ?? null)}>save</button>
        </div>
      );
    }
    render(
      <AuthContext.Provider value={LOGGED_OUT}>
        <MyListingsProvider>
          <GuardProbe />
        </MyListingsProvider>
      </AuthContext.Provider>,
    );

    await userEvent.click(screen.getByText('fill'));
    await userEvent.click(screen.getByText('save'));

    // No optimistic card, and the reason surfaces instead of faking success.
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('error')).toHaveTextContent(/log in/i);
  });

  it('prefills a garage car as a draft, not a live listing', async () => {
    function GarageProbe() {
      const { form, startFromGarage } = useMyListings();
      return (
        <div>
          <span data-testid="status">{form.status}</span>
          <button onClick={() => startFromGarage(GARAGE_CAR)}>list it</button>
        </div>
      );
    }
    render(
      <MockAuthProvider>
        <MyListingsProvider>
          <GarageProbe />
        </MyListingsProvider>
      </MockAuthProvider>,
    );

    await userEvent.click(screen.getByText('list it'));
    expect(screen.getByTestId('status')).toHaveTextContent('draft');
  });
});
