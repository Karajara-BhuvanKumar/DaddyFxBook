import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TradeDateTimePicker from '@/components/TradeDateTimePicker';

afterEach(cleanup);
function Fixture() {
  const [value, setValue] = useState('2026-10-10T00:47');
  return <><TradeDateTimePicker label="Open Date & Time" value={value} onChange={setValue} /><output data-testid="value">{value}</output></>;
}
describe('trade date and time picker', () => {
  it('edits 12-hour time, confirms once and preserves the date', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Date & Time' }));
    fireEvent.click(screen.getByRole('gridcell', { name: '10' }));
    expect(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveValue(12);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle AM/PM' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minute' }), { target: { value: '25' } });
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-10T00:47');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-10T12:25');
    expect(screen.getByRole('button', { name: 'Open Date & Time' })).toHaveTextContent('12:25 PM');
  });
  it('supports clearing and cancels an unconfirmed time change', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Date & Time' }));
    fireEvent.click(screen.getByRole('gridcell', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle AM/PM' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-10T00:47');
    fireEvent.click(screen.getByRole('button', { name: 'Open Date & Time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
  });
});


