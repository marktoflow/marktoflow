import { useState, useEffect } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';

export interface ZoomLevelState {
  zoom: number;
  showDetails: boolean;
  showLabels: boolean;
  showIcons: boolean;
}

/**
 * Hook to track zoom level and determine what details to show
 *
 * Zoom thresholds:
 * - < 0.5: Hide all details (minimal view)
 * - 0.5-0.75: Show icons only
 * - 0.75-1.0: Show icons + labels
 * - >= 1.0: Show all details
 */
export function useZoomLevel(): ZoomLevelState {
  const { zoom } = useViewport();

  return {
    zoom,
    showDetails: zoom >= 1.0,
    showLabels: zoom >= 0.75,
    showIcons: zoom >= 0.5,
  };
}

/**
 * Hook to get CSS classes based on zoom level
 */
export function useZoomClasses(): string {
  const { zoom, showDetails, showLabels, showIcons } = useZoomLevel();

  const classes: string[] = [];

  if (zoom < 0.5) {
    classes.push('zoom-minimal');
  } else if (zoom < 0.75) {
    classes.push('zoom-icons-only');
  } else if (zoom < 1.0) {
    classes.push('zoom-labels');
  } else {
    classes.push('zoom-full');
  }

  if (!showDetails) classes.push('hide-details');
  if (!showLabels) classes.push('hide-labels');
  if (!showIcons) classes.push('hide-icons');

  return classes.join(' ');
}

/**
 * Hook to determine if nested steps should be hidden based on zoom
 */
export function useHideNestedSteps(): boolean {
  const { zoom } = useViewport();
  return zoom < 0.6; // Hide nested steps when zoomed out below 60%
}
