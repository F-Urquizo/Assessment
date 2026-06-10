import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockAuthProvider } from './MockAuthProvider';
import { MyListingsProvider } from './MyListingsProvider';
import { useMyListings } from './MyListingsContext';
import { MOCK_OPTIONS } from '../lib/marketplace-mock';

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
        <MyListingsProvider options={MOCK_OPTIONS}>
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
        <MyListingsProvider options={MOCK_OPTIONS}>
          <BadProbe />
        </MyListingsProvider>
      </MockAuthProvider>,
    );
    await userEvent.click(screen.getByText('fill'));
    await userEvent.click(screen.getByText('save'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
