import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../components/common/Button';
import { getCurrentCycle, getCycleOptions, ROUND_TYPE_LABELS, STATUS_LABELS, ROUND_TYPE_DESCRIPTIONS, STATUS_DESCRIPTIONS } from '../types';

describe('Button Component', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading spinner when isLoading', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-blue-600');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-200');
  });

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6');
  });
});

describe('Type Utilities', () => {
  describe('getCurrentCycle', () => {
    it('returns current cycle in YYYY-YYYY format', () => {
      const cycle = getCurrentCycle();
      expect(cycle).toMatch(/^\d{4}-\d{4}$/);
    });

    it('returns consecutive years', () => {
      const cycle = getCurrentCycle();
      const [start, end] = cycle.split('-').map(Number);
      expect(end - start).toBe(1);
    });
  });

  describe('getCycleOptions', () => {
    it('returns array of cycle options', () => {
      const options = getCycleOptions();
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('value');
      expect(options[0]).toHaveProperty('label');
    });

    it('all options have valid cycle format', () => {
      const options = getCycleOptions();
      options.forEach((option) => {
        expect(option.value).toMatch(/^\d{4}-\d{4}$/);
      });
    });
  });

  describe('ROUND_TYPE_LABELS', () => {
    it('has all round types defined', () => {
      const roundTypes = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'];
      roundTypes.forEach((type) => {
        expect(ROUND_TYPE_LABELS[type as keyof typeof ROUND_TYPE_LABELS]).toBeDefined();
      });
    });

    it('has human-readable labels', () => {
      expect(ROUND_TYPE_LABELS.ED).toBe('Early Decision');
      expect(ROUND_TYPE_LABELS.RD).toBe('Regular Decision');
    });
  });

  describe('STATUS_LABELS', () => {
    it('has all statuses defined', () => {
      const statuses = ['PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED', 'WITHDRAWN'];
      statuses.forEach((status) => {
        expect(STATUS_LABELS[status as keyof typeof STATUS_LABELS]).toBeDefined();
      });
    });
  });

  describe('ROUND_TYPE_DESCRIPTIONS', () => {
    it('has descriptions for all round types', () => {
      const roundTypes = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'];
      roundTypes.forEach((type) => {
        expect(ROUND_TYPE_DESCRIPTIONS[type as keyof typeof ROUND_TYPE_DESCRIPTIONS]).toBeDefined();
        expect(ROUND_TYPE_DESCRIPTIONS[type as keyof typeof ROUND_TYPE_DESCRIPTIONS].length).toBeGreaterThan(0);
      });
    });

    it('ED description mentions binding', () => {
      expect(ROUND_TYPE_DESCRIPTIONS.ED.toLowerCase()).toContain('binding');
    });

    it('EA description mentions non-binding', () => {
      expect(ROUND_TYPE_DESCRIPTIONS.EA.toLowerCase()).toContain('non-binding');
    });
  });

  describe('STATUS_DESCRIPTIONS', () => {
    it('has descriptions for all statuses', () => {
      const statuses = ['PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED', 'WITHDRAWN'];
      statuses.forEach((status) => {
        expect(STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS]).toBeDefined();
        expect(STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS].length).toBeGreaterThan(0);
      });
    });
  });
});
