import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AudioLevelMeter } from '@/components/AudioLevelMeter';

describe('AudioLevelMeter', () => {
  it('renders RMS value', () => {
    render(<AudioLevelMeter rms={0.025} />);
    expect(screen.getByText('0.0250 RMS')).toBeInTheDocument();
  });

  it('shows green bar at low RMS', () => {
    const { container } = render(<AudioLevelMeter rms={0.01} />);
    const bar = container.querySelector('[class*="bg-green"]');
    expect(bar).toBeInTheDocument();
  });

  it('shows yellow bar at mid RMS', () => {
    const { container } = render(<AudioLevelMeter rms={0.07} />);
    const bar = container.querySelector('[class*="bg-yellow"]');
    expect(bar).toBeInTheDocument();
  });

  it('shows red bar at high RMS', () => {
    const { container } = render(<AudioLevelMeter rms={0.09} />);
    const bar = container.querySelector('[class*="bg-red"]');
    expect(bar).toBeInTheDocument();
  });

  it('displays negative infinity for zero RMS', () => {
    render(<AudioLevelMeter rms={0} />);
    expect(screen.getByText('-\u221E dB')).toBeInTheDocument();
  });

  it('displays dB value for non-zero RMS', () => {
    render(<AudioLevelMeter rms={0.1} />);
    // 20 * log10(0.1) = -20
    expect(screen.getByText('-20 dB')).toBeInTheDocument();
  });

  it('respects custom maxRms', () => {
    const { container } = render(<AudioLevelMeter rms={0.05} maxRms={0.05} />);
    // At maxRms, bar should be 100% width
    const bar = container.querySelector('[style*="width: 100%"]');
    expect(bar).toBeInTheDocument();
  });
});
