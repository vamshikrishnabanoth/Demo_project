import React from 'react';
import { render } from '@testing-library/react';
import PremiumLoader from './PremiumLoader';

describe('PremiumLoader Component', () => {
  test('renders the default message when none is provided', () => {
    const { container } = render(<PremiumLoader />);
    
    // Find the wrapper container of the letters
    const textContainer = container.querySelector('.flex-wrap');
    expect(textContainer).toBeInTheDocument();
    
    // Normalize any non-breaking spaces (\u00A0) back to standard spaces
    const normalizedText = textContainer.textContent.replace(/\u00a0/g, ' ');
    expect(normalizedText).toBe('Synchronizing neural pathways...');
  });

  test('renders a custom message prop correctly', () => {
    const { container } = render(<PremiumLoader message="Fetching quiz data..." />);
    
    const textContainer = container.querySelector('.flex-wrap');
    expect(textContainer).toBeInTheDocument();
    
    const normalizedText = textContainer.textContent.replace(/\u00a0/g, ' ');
    expect(normalizedText).toBe('Fetching quiz data...');
  });

  test('renders the core concentric ring loader element', () => {
    const { container } = render(<PremiumLoader />);
    
    // Check if the HTML element with .loader class is rendered
    const loaderNode = container.querySelector('.loader');
    expect(loaderNode).toBeInTheDocument();
  });
});
