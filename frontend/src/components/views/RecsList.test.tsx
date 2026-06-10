import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecsList from './RecsList';
import type { Recommendation } from '../../types';

describe('RecsList', () => {
  it('shows the empty-state copy when there are no recommendations', () => {
    render(<RecsList recs={[]} />);
    expect(screen.getByText(/no high-ROI improvements/i)).toBeInTheDocument();
  });

  it('renders one row per recommendation with its label and formatted delta', () => {
    const recs: Recommendation[] = [
      { kind: 'condition', label: 'Detail the interior', detail: 'fixes visible wear', delta: 1200 },
      { kind: 'mileage', label: 'Verify the odometer', detail: 'service records', delta: 800 },
    ];
    render(<RecsList recs={recs} />);

    expect(screen.getByText('Detail the interior')).toBeInTheDocument();
    expect(screen.getByText('+1,200')).toBeInTheDocument();
    expect(screen.getByText('+800')).toBeInTheDocument();
  });
});
