const priorityMap: {
  [key: string]: number
} = {
  lowest: -20,
  low: -10,
  normal: 0,
  high: 10,
  highest: 20
};

/**
 * Internal method to turn priority into a number
 * @param priority string to parse into number
 */
export const parsePriority = (priority: string | number): number => {
  if (typeof priority === 'number') {
    return priority;
  }

  return priorityMap[priority];
};
