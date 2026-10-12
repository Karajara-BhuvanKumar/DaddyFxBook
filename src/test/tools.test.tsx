import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tools from '@/pages/Tools';
import PositionSizeCalculator from '@/components/tools/PositionSizeCalculator';
afterEach(cleanup);

describe('Tools page and calculator controls', () => {
  it('exposes only two cards and accurate counts', () => {
    render(<MemoryRouter initialEntries={['/tools']}><Tools /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Open Position Size Calculator' })).toHaveAttribute('href', '/tools/position-size-calculator');
    expect(screen.getByText('Available').parentElement).toHaveTextContent('2Available');
    expect(screen.getByText('Coming soon').parentElement).toHaveTextContent('0Coming soon');
  });
  it('synchronizes exact risk, slider and results and clears stale invalid results', () => {
    render(<PositionSizeCalculator />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Account balance' }), { target: { value: '10000' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Stop loss distance' }), { target: { value: '20' } });
    const input = screen.getByRole('spinbutton', { name: 'Risk percentage' });
    for (const [risk, amount] of [['0.6', '$60.00'], ['0.75', '$75.00'], ['1.25', '$125.00'], ['1.5', '$150.00'], ['0.755', '$75.50']]) {
      fireEvent.change(input, { target: { value: risk } });
      expect(screen.getByRole('slider')).toHaveValue(risk);
      expect(screen.getByTestId('risk-amount')).toHaveTextContent(amount);
      expect(screen.getByTestId('risk-preview')).toHaveTextContent(amount);
    }
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.25' } });
    expect(input).toHaveValue(1.25);
    expect(screen.getByTestId('standard-lots')).toHaveTextContent('0.62');
    expect(screen.getByTestId('loss-at-stop')).toHaveTextContent('$124.00');
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(input).toHaveValue(1.26);
    for (const value of ['-1', '0', '101', '']) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('standard-lots')).not.toBeInTheDocument();
    }
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Trading instrument' }), { target: { value: 'XAUUSD' } });
    expect(screen.getByTestId('standard-lots')).toHaveTextContent('5');
    expect(screen.getByTestId('loss-at-stop')).toHaveTextContent('$100.00');
    fireEvent.click(screen.getByLabelText('Use custom pip value'));
    expect(screen.queryByTestId('standard-lots')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Pip value in USD per standard lot' }), { target: { value: '5' } });
    expect(screen.getByTestId('standard-lots')).toHaveTextContent('1');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Stop loss distance' }), { target: { value: '0' } });
    expect(screen.queryByTestId('standard-lots')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'Account balance' })).toHaveValue(null);
    expect(screen.getByLabelText('Use custom pip value')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: '0.5%' })).not.toBeInTheDocument();
  });
});
