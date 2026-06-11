import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../context/ToastProvider';
import { StudioProvider } from '../../context/StudioProvider';
import { MOCK_OPTIONS } from '../../lib/marketplace-mock';
import SpecWizard from './SpecWizard';

function renderWizard() {
  return render(
    <ToastProvider>
      <StudioProvider options={MOCK_OPTIONS}>
        <SpecWizard />
      </StudioProvider>
    </ToastProvider>,
  );
}

describe('SpecWizard', () => {
  it('starts on step 1 (manufacturer) and advances when an option is picked', async () => {
    renderWizard();
    expect(screen.getByText('Step 1 of 13')).toBeInTheDocument();
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'ford' }));

    expect(screen.getByText('Step 2 of 13')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('can go back to the previous step', async () => {
    renderWizard();
    await userEvent.click(screen.getByRole('button', { name: 'toyota' }));
    expect(screen.getByText('Step 2 of 13')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Step 1 of 13')).toBeInTheDocument();
  });
});
