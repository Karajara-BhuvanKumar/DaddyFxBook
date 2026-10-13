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
    expect(input).toHaveValue(1.5);
    for (const value of ['-1', '0', '101', '']) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('standard-lots')).not.toBeInTheDocument();
    }
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Trading instrument' }), { target: { value: 'XAUUSD' } });
    expect(screen.getByTestId('standard-lots')).toHaveTextContent('0.5');
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
  it('matches the Gold reference and recalculates all inputs without rounding away mini/micro precision', () => {
    render(<PositionSizeCalculator />);
    const balance = screen.getByRole('spinbutton', { name: 'Account balance' });
    const risk = screen.getByRole('spinbutton', { name: 'Risk percentage' });
    const stop = screen.getByRole('spinbutton', { name: 'Stop loss distance' });
    const symbol = screen.getByRole('combobox', { name: 'Trading instrument' });
    const change = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
    const results = (lots: string, mini: string, micro: string, amount: string, loss = amount) => {
      for (const [id, value] of [['standard-lots', lots], ['mini-lots', mini], ['micro-lots', micro], ['risk-amount', amount], ['loss-at-stop', loss]]) {
        expect(screen.getByTestId(id).textContent).toBe(value);
      }
    };
    change(balance, '10000');
    change(stop, '30');
    change(symbol, 'XAUUSD');
    expect(screen.getByText('Pip size: 0.1')).toBeInTheDocument();
    expect(screen.getByText('Pip value: $10.00/pip/lot')).toBeInTheDocument();
    expect(screen.getByText(/1 standard lot = 100 troy ounces/)).toBeInTheDocument();
    results('0.33', '3.33', '33.33', '$100.00');
    expect(screen.getByText(/round down to 0.33 standard lots for \$99.00 loss/)).toBeInTheDocument();
    for (const [percent, lots, mini, micro, amount] of [
      ['0.6', '0.2', '2', '20', '$60.00'],
      ['0.75', '0.25', '2.5', '25', '$75.00'],
      ['1.25', '0.42', '4.17', '41.67', '$125.00'],
      ['1.4', '0.47', '4.67', '46.67', '$140.00'],
      ['1.65', '0.55', '5.5', '55', '$165.00'],
    ]) {
      change(risk, percent);
      expect(screen.getByRole('slider')).toHaveValue(percent);
      results(lots, mini, micro, amount);
    }
    change(risk, '1');
    change(balance, '20000');
    results('0.67', '6.67', '66.67', '$200.00');
    change(stop, '60');
    results('0.33', '3.33', '33.33', '$200.00');
    fireEvent.click(screen.getByLabelText('Use custom pip value'));
    expect(screen.queryByTestId('standard-lots')).not.toBeInTheDocument();
    const custom = screen.getByLabelText('Pip value in USD per standard lot');
    change(custom, '20');
    results('0.17', '1.67', '16.67', '$200.00');
    for (const input of [custom, balance, stop]) {
      const saved = (input as HTMLInputElement).value;
      for (const invalid of ['0', '-1', '']) {
        change(input, invalid);
        expect(screen.queryByTestId('standard-lots')).not.toBeInTheDocument();
        expect(screen.queryByTestId('loss-at-stop')).not.toBeInTheDocument();
      }
      change(input, saved);
    }
    // A custom pip value is an explicit override even when instruments change.
    change(symbol, 'EURUSD');
    expect(screen.getByText('Pip size: 0.0001')).toBeInTheDocument();
    expect(screen.getByText('Pip value: $20.00/pip/lot')).toBeInTheDocument();
    results('0.16', '1.6', '16', '$200.00', '$192.00');
    fireEvent.click(screen.getByLabelText('Use custom pip value'));
    for (const forex of ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD']) {
      change(symbol, forex);
      expect(screen.getByText('Pip value: $10.00/pip/lot')).toBeInTheDocument();
      results('0.33', '3.3', '33', '$200.00', '$198.00');
    }
    change(symbol, 'XAUUSD');
    change(balance, '10');
    results('0', '0', '0', '$0.10', '$0.00');
    expect(screen.getByText(/No position fits these parameters/)).toHaveAttribute('role', 'status');
  });
  it('steps the slider by quarters, preserves off-grid typed values, and handles bounds', () => {
    render(<PositionSizeCalculator />);
    const risk = screen.getByRole('spinbutton', { name: 'Risk percentage' });
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('max', '10');
    fireEvent.change(risk, { target: { value: '0.5' } });
    for (const next of [0.75, 1, 1.25, 1.5, 1.75, 2]) {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(risk).toHaveValue(next);
      expect(slider).toHaveValue(String(next));
    }
    fireEvent.change(risk, { target: { value: '1.65' } });
    expect(slider).toHaveValue('1.65');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(risk).toHaveValue(1.75);
    fireEvent.change(risk, { target: { value: '1.65' } });
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(risk).toHaveValue(1.5);
    fireEvent.change(slider, { target: { value: '1.63' } });
    expect(risk).toHaveValue(1.75);
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(risk).toHaveValue(2.75);
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(risk).toHaveValue(1.75);
    fireEvent.keyDown(slider, { key: 'Home' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(risk).toHaveValue(0.25);
    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(risk).toHaveValue(10);
    for (const value of ['0.01', '0.755', '15.65', '100']) {
      fireEvent.change(risk, { target: { value } });
      expect(risk).toHaveValue(Number(value));
      expect(slider).toHaveValue(value);
    }
    expect(slider).toHaveAttribute('max', '100');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(risk).toHaveValue(100);
  });
});
