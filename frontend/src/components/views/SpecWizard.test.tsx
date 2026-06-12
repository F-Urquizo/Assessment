import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../context/ToastProvider';
import { StudioProvider } from '../../context/StudioProvider';
import { MOCK_OPTIONS } from '../../lib/marketplace-mock';
import SpecWizard from './SpecWizard';

function renderWizard() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <StudioProvider options={MOCK_OPTIONS}>
          <SpecWizard />
        </StudioProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** Advance one step: fields now start blank, so on a text/number step type a
 *  value (Next is disabled until then) before clicking Next; on a select step
 *  pick the first option (which auto-advances). */
async function nextStep() {
  const input = document.querySelector('.wiz-input') as HTMLInputElement | null;
  if (input) {
    if (!input.value) {
      await userEvent.type(input, input.type === 'number' ? '2019' : 'f-150');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    return;
  }
  const option = document.querySelector('.wiz-opt') as HTMLButtonElement;
  await userEvent.click(option);
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

  it('lets you jump straight back to an earlier step via the stepper', async () => {
    renderWizard();
    await userEvent.click(screen.getByRole('button', { name: 'ford' })); // → step 2
    await nextStep(); // model → step 3
    expect(screen.getByText('Step 3 of 13')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Step 1: Manufacturer/i }));
    expect(screen.getByText('Step 1 of 13')).toBeInTheDocument();
  });

  it('ends on a review screen — it does not auto-appraise on the last answer', async () => {
    renderWizard();
    for (let i = 0; i < 13; i += 1) await nextStep();

    expect(
      screen.getByText('Review · confirm your answers'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Appraise →' }),
    ).toBeInTheDocument();
    // The appraisal has NOT run yet — no success marker is shown.
    expect(screen.queryByText(/✓ appraised/)).not.toBeInTheDocument();
  });
});
